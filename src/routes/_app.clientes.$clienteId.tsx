import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Upload, Check } from "lucide-react";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_app/clientes/$clienteId")({
  component: ClienteDetailPage,
  head: () => ({
    meta: [{ title: "Detalhe do Cliente — Milena Rezende" }],
  }),
});

function ClienteDetailPage() {
  const { clienteId } = Route.useParams();
  const { user } = useAuth();
  const [cliente, setCliente] = useState<Tables<"clientes"> | null>(null);
  const [contrato, setContrato] = useState<Tables<"contratos"> | null>(null);
  const [cobrancas, setCobrancas] = useState<Tables<"cobrancas">[]>([]);
  const [agendaItems, setAgendaItems] = useState<Tables<"agenda">[]>([]);
  const [arquivos, setArquivos] = useState<Tables<"arquivos">[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [contratoDialog, setContratoDialog] = useState(false);
  const [cobrancaDialog, setCobrancaDialog] = useState(false);
  const [agendaDialog, setAgendaDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);

  // Forms
  const [contratoForm, setContratoForm] = useState({ tipo: "mensal", valor: "", duracao_meses: "12", desconto: "" });
  const [cobrancaForm, setCobrancaForm] = useState({ valor: "", data_vencimento: "" });
  const [agendaForm, setAgendaForm] = useState({ data: "", descricao: "" });
  const [editForm, setEditForm] = useState({ nome: "", email: "", telefone: "", cor_principal: "", ativo: true });

  useEffect(() => {
    if (user) loadAll();
  }, [user, clienteId]);

  async function loadAll() {
    const [cRes, ctRes, cbRes, agRes, arRes] = await Promise.all([
      supabase.from("clientes").select("*").eq("id", clienteId).single(),
      supabase.from("contratos").select("*").eq("cliente_id", clienteId).eq("ativo", true).maybeSingle(),
      supabase.from("cobrancas").select("*").eq("cliente_id", clienteId).order("data_vencimento", { ascending: false }),
      supabase.from("agenda").select("*").eq("cliente_id", clienteId).order("data", { ascending: true }),
      supabase.from("arquivos").select("*").eq("cliente_id", clienteId).order("created_at", { ascending: false }),
    ]);
    setCliente(cRes.data);
    setContrato(ctRes.data);
    setCobrancas(cbRes.data || []);
    setAgendaItems(agRes.data || []);
    setArquivos(arRes.data || []);
    if (cRes.data) {
      setEditForm({
        nome: cRes.data.nome,
        email: cRes.data.email || "",
        telefone: cRes.data.telefone || "",
        cor_principal: cRes.data.cor_principal || "#065C39",
        ativo: cRes.data.ativo,
      });
    }
    setLoading(false);
  }

  async function handleSaveCliente(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("clientes").update({
      nome: editForm.nome,
      email: editForm.email || null,
      telefone: editForm.telefone || null,
      cor_principal: editForm.cor_principal,
      ativo: editForm.ativo,
    }).eq("id", clienteId);
    setEditDialog(false);
    loadAll();
  }

  async function handleCreateContrato(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    await supabase.from("contratos").insert({
      cliente_id: clienteId,
      user_id: user.id,
      tipo: contratoForm.tipo,
      valor: parseFloat(contratoForm.valor),
      duracao_meses: parseInt(contratoForm.duracao_meses),
      desconto: contratoForm.desconto ? parseFloat(contratoForm.desconto) : 0,
    });
    setContratoDialog(false);
    setContratoForm({ tipo: "mensal", valor: "", duracao_meses: "12", desconto: "" });
    loadAll();
  }

  async function handleCreateCobranca(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    await supabase.from("cobrancas").insert({
      cliente_id: clienteId,
      user_id: user.id,
      valor: parseFloat(cobrancaForm.valor),
      data_vencimento: cobrancaForm.data_vencimento,
    });
    setCobrancaDialog(false);
    setCobrancaForm({ valor: "", data_vencimento: "" });
    loadAll();
  }

  async function handleMarkPago(id: string) {
    await supabase.from("cobrancas").update({ status: "pago" }).eq("id", id);
    loadAll();
  }

  async function handleCreateAgenda(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    await supabase.from("agenda").insert({
      cliente_id: clienteId,
      user_id: user.id,
      data: agendaForm.data,
      descricao: agendaForm.descricao,
    });
    setAgendaDialog(false);
    setAgendaForm({ data: "", descricao: "" });
    loadAll();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${clienteId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("client-files").upload(path, file);
    if (error) return;
    const { data: urlData } = supabase.storage.from("client-files").getPublicUrl(path);
    const tipo = file.type.startsWith("image/") ? "imagem" : "documento";
    await supabase.from("arquivos").insert({
      cliente_id: clienteId,
      user_id: user.id,
      url: urlData.publicUrl,
      tipo,
      nome: file.name,
    });
    loadAll();
  }

  if (loading || !cliente) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div>
      <Link to="/clientes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-primary-foreground"
            style={{ backgroundColor: cliente.cor_principal || "#065C39" }}
          >
            {cliente.nome.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{cliente.nome}</h1>
            <p className="text-sm text-muted-foreground">{cliente.email} · {cliente.telefone}</p>
          </div>
        </div>
        <Dialog open={editDialog} onOpenChange={setEditDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">Editar</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Editar Cliente</DialogTitle></DialogHeader>
            <form onSubmit={handleSaveCliente} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={editForm.telefone} onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Cor Principal</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={editForm.cor_principal} onChange={(e) => setEditForm({ ...editForm, cor_principal: e.target.value })} className="h-9 w-12 cursor-pointer rounded border" />
                  <Input value={editForm.cor_principal} onChange={(e) => setEditForm({ ...editForm, cor_principal: e.target.value })} className="flex-1" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="ativo" checked={editForm.ativo} onChange={(e) => setEditForm({ ...editForm, ativo: e.target.checked })} />
                <Label htmlFor="ativo">Cliente ativo</Label>
              </div>
              <Button type="submit" className="w-full">Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Contrato */}
      <div className="mt-6 rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Contrato</h2>
          {!contrato && (
            <Dialog open={contratoDialog} onOpenChange={setContratoDialog}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1 h-3 w-3" />Criar Contrato</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo Contrato</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateContrato} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={contratoForm.tipo} onValueChange={(v) => setContratoForm({ ...contratoForm, tipo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="pacote">Pacote</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <Input type="number" step="0.01" value={contratoForm.valor} onChange={(e) => setContratoForm({ ...contratoForm, valor: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Duração (meses)</Label>
                    <Select value={contratoForm.duracao_meses} onValueChange={(v) => setContratoForm({ ...contratoForm, duracao_meses: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 meses</SelectItem>
                        <SelectItem value="6">6 meses</SelectItem>
                        <SelectItem value="12">12 meses</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Desconto (R$)</Label>
                    <Input type="number" step="0.01" value={contratoForm.desconto} onChange={(e) => setContratoForm({ ...contratoForm, desconto: e.target.value })} />
                  </div>
                  <Button type="submit" className="w-full">Criar</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
        {contrato ? (
          <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted-foreground">Tipo:</span> <span className="font-medium capitalize">{contrato.tipo}</span></div>
            <div><span className="text-muted-foreground">Valor:</span> <span className="font-medium">R$ {Number(contrato.valor).toFixed(2)}</span></div>
            <div><span className="text-muted-foreground">Duração:</span> <span className="font-medium">{contrato.duracao_meses} meses</span></div>
            <div><span className="text-muted-foreground">Desconto:</span> <span className="font-medium">R$ {Number(contrato.desconto || 0).toFixed(2)}</span></div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Nenhum contrato ativo.</p>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="financeiro" className="mt-6">
        <TabsList>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="arquivos">Arquivos</TabsTrigger>
        </TabsList>

        <TabsContent value="financeiro" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Cobranças</h3>
            <Dialog open={cobrancaDialog} onOpenChange={setCobrancaDialog}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1 h-3 w-3" />Nova Cobrança</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova Cobrança</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateCobranca} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <Input type="number" step="0.01" value={cobrancaForm.valor} onChange={(e) => setCobrancaForm({ ...cobrancaForm, valor: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Vencimento</Label>
                    <Input type="date" value={cobrancaForm.data_vencimento} onChange={(e) => setCobrancaForm({ ...cobrancaForm, data_vencimento: e.target.value })} required />
                  </div>
                  <Button type="submit" className="w-full">Criar</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          {cobrancas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma cobrança.</p>
          ) : (
            <div className="space-y-2">
              {cobrancas.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border bg-card p-4">
                  <div>
                    <p className="font-medium">R$ {Number(c.valor).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Venc: {format(new Date(c.data_vencimento + "T12:00:00"), "dd/MM/yyyy")}</p>
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
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="agenda" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Agenda</h3>
            <Dialog open={agendaDialog} onOpenChange={setAgendaDialog}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1 h-3 w-3" />Novo Item</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo Item na Agenda</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateAgenda} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input type="date" value={agendaForm.data} onChange={(e) => setAgendaForm({ ...agendaForm, data: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Input value={agendaForm.descricao} onChange={(e) => setAgendaForm({ ...agendaForm, descricao: e.target.value })} required />
                  </div>
                  <Button type="submit" className="w-full">Criar</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          {agendaItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum item na agenda.</p>
          ) : (
            <div className="space-y-2">
              {agendaItems.map((a) => (
                <div key={a.id} className="flex items-center gap-4 rounded-lg border bg-card p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                    {format(new Date(a.data + "T12:00:00"), "dd/MM")}
                  </div>
                  <p className="text-sm">{a.descricao}</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="arquivos" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Arquivos</h3>
            <label className="cursor-pointer">
              <Button size="sm" asChild>
                <span><Upload className="mr-1 h-3 w-3" />Upload</span>
              </Button>
              <input type="file" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
          {arquivos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum arquivo.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {arquivos.map((a) => (
                <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50">
                  {a.tipo === "imagem" ? (
                    <img src={a.url} alt={a.nome || "Arquivo"} className="mb-2 h-24 w-full rounded object-cover" />
                  ) : (
                    <div className="mb-2 flex h-24 items-center justify-center rounded bg-muted text-xs text-muted-foreground">DOC</div>
                  )}
                  <p className="truncate text-xs font-medium">{a.nome || "Arquivo"}</p>
                </a>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
