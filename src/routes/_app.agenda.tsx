import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_app/agenda")({
  component: AgendaPage,
  head: () => ({
    meta: [{ title: "Agenda — Milena Rezende" }],
  }),
});

function AgendaPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<(Tables<"agenda"> & { cliente_nome?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadAgenda();
  }, [user]);

  async function loadAgenda() {
    const { data } = await supabase.from("agenda").select("*").order("data", { ascending: true });
    if (!data) { setLoading(false); return; }
    const clienteIds = [...new Set(data.map((a) => a.cliente_id))];
    const { data: clientes } = await supabase.from("clientes").select("id, nome").in("id", clienteIds);
    const nomes: Record<string, string> = {};
    clientes?.forEach((c) => { nomes[c.id] = c.nome; });
    setItems(data.map((a) => ({ ...a, cliente_nome: nomes[a.cliente_id] || "—" })));
    setLoading(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando...</div>;
  }

  // Group by date
  const grouped: Record<string, typeof items> = {};
  items.forEach((item) => {
    const key = item.data;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Agenda</h1>
      {Object.keys(grouped).length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">Nenhum item na agenda.</p>
      ) : (
        <div className="mt-6 space-y-6">
          {Object.entries(grouped).map(([date, dateItems]) => (
            <div key={date}>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                {format(new Date(date + "T12:00:00"), "dd/MM/yyyy")}
              </h3>
              <div className="space-y-2">
                {dateItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 rounded-lg border bg-card p-4">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
                    >
                      {item.cliente_nome?.charAt(0) || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.descricao}</p>
                      <p className="text-xs text-muted-foreground">{item.cliente_nome}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
