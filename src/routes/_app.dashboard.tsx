import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { StatCard } from "@/components/StatCard";
import { Users, DollarSign, AlertCircle, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [{ title: "Dashboard — Milena Rezende" }],
  }),
});

interface DashboardData {
  clientesAtivos: number;
  faturamentoMes: number;
  contasPendentes: number;
  proximosAtendimentos: Array<{
    id: string;
    data: string;
    descricao: string;
    cliente_nome: string;
  }>;
}

function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData>({
    clientesAtivos: 0,
    faturamentoMes: 0,
    contasPendentes: 0,
    proximosAtendimentos: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadDashboard();
  }, [user]);

  async function loadDashboard() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    const [clientesRes, faturamentoRes, pendentesRes, agendaRes] = await Promise.all([
      supabase.from("clientes").select("id", { count: "exact" }).eq("ativo", true),
      supabase.from("cobrancas").select("valor").eq("status", "pago").gte("data_vencimento", startOfMonth).lte("data_vencimento", endOfMonth),
      supabase.from("cobrancas").select("id", { count: "exact" }).eq("status", "pendente"),
      supabase.from("agenda").select("id, data, descricao, cliente_id").gte("data", now.toISOString().split("T")[0]).order("data", { ascending: true }).limit(5),
    ]);

    const clienteIds = agendaRes.data?.map((a) => a.cliente_id) || [];
    let clienteNomes: Record<string, string> = {};
    if (clienteIds.length > 0) {
      const { data: clientes } = await supabase.from("clientes").select("id, nome").in("id", clienteIds);
      clientes?.forEach((c) => { clienteNomes[c.id] = c.nome; });
    }

    const faturamento = faturamentoRes.data?.reduce((sum, c) => sum + Number(c.valor), 0) || 0;

    setData({
      clientesAtivos: clientesRes.count || 0,
      faturamentoMes: faturamento,
      contasPendentes: pendentesRes.count || 0,
      proximosAtendimentos: (agendaRes.data || []).map((a) => ({
        id: a.id,
        data: a.data,
        descricao: a.descricao,
        cliente_nome: clienteNomes[a.cliente_id] || "—",
      })),
    });
    setLoading(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Clientes Ativos" value={data.clientesAtivos} icon={Users} />
        <StatCard
          title="Faturamento do Mês"
          value={`R$ ${data.faturamentoMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
        />
        <StatCard title="Contas Pendentes" value={data.contasPendentes} icon={AlertCircle} />
        <StatCard title="Próx. Atendimentos" value={data.proximosAtendimentos.length} icon={CalendarDays} />
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold">Próximos Atendimentos</h2>
        {data.proximosAtendimentos.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nenhum atendimento agendado.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {data.proximosAtendimentos.map((item) => (
              <div key={item.id} className="flex items-center gap-4 rounded-lg border bg-card p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                  {format(new Date(item.data + "T12:00:00"), "dd", { locale: ptBR })}
                  <br />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.descricao}</p>
                  <p className="text-xs text-muted-foreground">{item.cliente_nome} · {format(new Date(item.data + "T12:00:00"), "dd/MM/yyyy")}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
