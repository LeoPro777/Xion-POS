"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Search, Printer, MoreVertical, XCircle, FileText } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { useDeliveryNotes, useCancelDeliveryNote } from "@/hooks/queries/use-delivery-notes"

const formatLocalNumber = (num: number): string => {
  return num.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function DeliveryNotesModule() {
  const [searchQuery, setSearchQuery] = useState("")
  const { data: notes = [], isLoading } = useDeliveryNotes()
  const cancelNote = useCancelDeliveryNote()

  const filteredNotes = notes.filter((note) => {
    const term = searchQuery.toLowerCase()
    return (
      note.client_name.toLowerCase().includes(term) ||
      note.document_number.toString().includes(term) ||
      note.document_type.toLowerCase().includes(term)
    )
  })

  const handlePrint = (id: string) => {
    window.open(`http://127.0.0.1:8000/api/v1/delivery-notes/${id}/pdf`, "_blank")
  }

  const handleCancel = async (id: string) => {
    if (!confirm("¿Está seguro de que desea anular este documento? Si es Nota de Entrega, el inventario será reversado.")) {
      return
    }
    try {
      await cancelNote.mutateAsync(id)
      toast.success("Documento anulado con éxito.")
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Error al anular el documento.")
    }
  }

  return (
    <div className="flex-1 overflow-auto p-6 bg-background/50">
      <Card className="h-full border-border/50 shadow-xl flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-black text-foreground flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Notas de Entrega y Prefacturas
            </CardTitle>
            <p className="text-sm text-muted-foreground">Historial de documentos no fiscales emitidos.</p>
          </div>
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, número o tipo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-card border-2"
            />
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground">Cargando documentos...</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Total USD</TableHead>
                  <TableHead className="text-right">Total Bs</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No se encontraron documentos.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredNotes.map((note) => (
                    <TableRow key={note.id}>
                      <TableCell className="font-mono font-bold">
                        {String(note.document_number).padStart(6, '0')}
                      </TableCell>
                      <TableCell>
                        {new Date(note.created_at).toLocaleString("es-VE", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </TableCell>
                      <TableCell className="font-medium">{note.client_name}</TableCell>
                      <TableCell>
                        <Badge variant={note.document_type === "PREFACTURA" ? "secondary" : "default"}>
                          {note.document_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">
                        ${formatLocalNumber(note.total_amount_usd)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        Bs {formatLocalNumber(note.total_amount_bs)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={note.status === "EMITIDA" ? "outline" : "destructive"}
                          className="font-bold"
                        >
                          {note.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handlePrint(note.id)}>
                              <Printer className="mr-2 h-4 w-4 text-primary" />
                              <span>Ver / Imprimir PDF</span>
                            </DropdownMenuItem>
                            {note.status !== "ANULADA" && (
                              <DropdownMenuItem
                                onClick={() => handleCancel(note.id)}
                                className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                <span>Anular</span>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
