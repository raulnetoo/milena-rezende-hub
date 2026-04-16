import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_app/financeiro")({
  component: FinanceiroPage,
  head: () => ({
    meta: [{ title: "Financeiro — Milena Rezende" }],
  }),
});

function FinanceiroPage() {
  const { user } = useAuth();
  const [cobrancas, setCobrancas] = useState<(Tables<"cobrancas"> & { cliente_nome?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"todos" | "pendente" | "pago">("todos");

  useEffect(() => {
    if (user) loadCobrancas();
  }, [user]);

  async function loadCobrancas() {
    const { data } = await supabase.from("cobrancas").select("*").order("data_vencimento", { ascending: false });
    if (!data) { setLoading(false); return; }
    const clienteIds = [...new Set(data.map((c) => c.cliente_id))];
    const { data: clientes } = await supabase.from("clientes").select("id, nome").in("id", clienteIds);
    const nomes: Record<string, string> = {};
    clientes?.forEach((c) => { nomes[c.id] = c.nome; });
    setCobrancas(data.map((c) => ({ ...c, cliente_nome: nomes[c.cliente_id] || "—" })));
    setLoading(false);
  }

  async function handleMarkPago(id: string) {
    await supabase.from("cobrancas").update({ status: "pago" }).eq("id", id);
    loadCobrancas();
  }

  const filtered = cobrancas.filter((c) => filter === "todos" || c.status === filter);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Financeiro</h1>
      <div className="mt-4 flex gap-2">
        {(["todos", "pendente", "pago"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize">
            {f}
          </Button>
        ))}
      </div>
      <div className="mt-6 space-y-2">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma cobrança encontrada.</p>
        ) : (
          filtered.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border bg-card p-4">
              <div>
                <p className="font-medium">R$ {Number(c.valor).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">{c.cliente_nome} · Venc: {format(new Date(c.data_vencimento + "T12:00:00"), "dd/MM/yyyy")}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c.status === "pago" ? "bg-success/10 text-success" : "bg-warning/10 text-warning-foreground"}`}>
                  {c.status === "pago" ? "Pago" : "Pendente"}
                </span>
                {c.status === "pendente" && (
                  <Button size="sm" variant="outline" onClick={() => handleMarkPago(c.id)}>
                    <Check className="mr-1 h-3 w-3" />Pagar
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
