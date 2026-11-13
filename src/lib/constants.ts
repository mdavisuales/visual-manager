export const STATUS_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  EN_REVISION: "En revisión",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
  EJECUTADA: "Ejecutada",
  CANCELADA: "Cancelada",
};

export const STATUS_STYLE: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-900",
  EN_REVISION: "bg-sky-100 text-sky-900",
  APROBADA: "bg-emerald-100 text-emerald-900",
  RECHAZADA: "bg-red-100 text-red-900",
  EJECUTADA: "bg-slate-200 text-slate-800",
  CANCELADA: "bg-slate-100 text-slate-600",
};

export const STATUS_MESSAGE: Record<string, string> = {
  PENDIENTE: "Recibimos tu solicitud y está en la cola de revisión.",
  EN_REVISION: "El equipo está revisando tu solicitud y la disponibilidad.",
  APROBADA: "Tu solicitud fue aprobada. El ministerio se pondrá en contacto contigo si hace falta algún detalle.",
  RECHAZADA: "Tu solicitud no pudo ser atendida. El ministerio puede contactarte para explicarte el motivo.",
  EJECUTADA: "El apoyo técnico de esta solicitud ya se realizó.",
  CANCELADA: "Esta solicitud fue cancelada.",
};

export const LOCATION_LABEL: Record<string, string> = {
  AUDITORIO_PRINCIPAL: "Auditorio principal",
  AUDITORIO_AUXILIAR: "Auditorio auxiliar",
  SALON_IGLESIA: "Salón de la iglesia",
  FUERA_IGLESIA: "Fuera de la iglesia",
};

export const ROLE_LABEL: Record<string, string> = {
  COORDINADOR: "Coordinador",
  LIDER: "Líder",
  SERVIDOR: "Servidor",
};

export const ASSIGNMENT_LABEL: Record<string, string> = {
  PENDIENTE: "Por confirmar",
  CONFIRMADA: "Confirmada",
  CANCELADA: "Cancelada",
};

export const ASSIGNMENT_STYLE: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-900",
  CONFIRMADA: "bg-emerald-100 text-emerald-900",
  CANCELADA: "bg-slate-200 text-slate-700",
};

export const SERVICE_LABEL: Record<string, string> = {
  PROGRAMADO: "Programado",
  REALIZADO: "Realizado",
  CANCELADO: "Cancelado",
};

export const CHANGE_LABEL: Record<string, string> = {
  REEMPLAZO: "Reemplazo",
  INTERCAMBIO: "Intercambio",
  EMERGENCIA: "Emergencia",
};

export const CHANGE_STATUS_LABEL: Record<string, string> = {
  PENDIENTE: "Esperando respuesta",
  ACEPTADO: "Aceptado",
  RECHAZADO: "Rechazado",
  RETIRADO: "Retirado",
  RESUELTO: "Atendida",
};

export const MOVEMENT_LABEL: Record<string, string> = {
  REGISTRO: "Registro",
  EDICION: "Edición",
  ESTADO: "Cambio de estado",
  PRESTAMO: "Préstamo",
  DEVOLUCION: "Devolución",
  RESERVA: "Reserva",
  EN_USO: "En uso",
  FIN_USO: "Fin de uso",
  LIBERACION: "Reserva liberada",
};

export const RESERVATION_LABEL: Record<string, string> = {
  RESERVADO: "Reservado",
  EN_USO: "En uso",
  DEVUELTO: "Devuelto",
  CANCELADO: "Cancelado",
};
