export const APTITUDES = [
  { key: "equipo", q: "Disfruto trabajar en equipo" },
  { key: "presion", q: "Mantengo la calma cuando algo falla en vivo" },
  { key: "puntualidad", q: "Llego con tiempo a mis compromisos" },
  { key: "aprender", q: "Me gusta aprender temas técnicos nuevos" },
  { key: "detalle", q: "Reviso los detalles antes de que algo llegue a la congregación" },
];

export type TestData = {
  areas: Record<string, { interest: number; experience: number; knowledge: number }>;
  skills: string[];
  aptitudes: Record<string, number>;
  comments?: string;
};

// Promedio por área, de mayor a menor. Es solo una orientación para el coordinador.
export function areaScores(data: TestData) {
  return Object.entries(data.areas ?? {})
    .map(([areaId, v]) => ({ areaId, score: Math.round(((v.interest + v.experience + v.knowledge) / 3) * 10) / 10 }))
    .sort((a, b) => b.score - a.score);
}
