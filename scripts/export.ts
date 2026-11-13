import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

// Copia de seguridad en JSON de todos los datos (sin contraseñas). Uso: npm run db:export
const prisma = new PrismaClient();

async function main() {
  const [users, requests, requirements, settings, permissions, notifications, services, assignments, areas, skills, equipment, loans, movements, packages, reservations, issues, trainings, participations, reports] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, email: true, phone: true, role: true, active: true, createdAt: true, birthMonth: true, birthDay: true } }),
    prisma.serviceRequest.findMany({ include: { requirements: { select: { id: true, name: true } } } }),
    prisma.techRequirement.findMany(),
    prisma.setting.findMany(),
    prisma.rolePermission.findMany(),
    prisma.notification.findMany(),
    prisma.service.findMany(),
    prisma.assignment.findMany(),
    prisma.area.findMany(),
    prisma.skill.findMany(),
    prisma.equipment.findMany({ include: { category: true } }),
    prisma.equipmentLoan.findMany(),
    prisma.equipmentMovement.findMany(),
    prisma.techPackage.findMany({ include: { items: true } }),
    prisma.equipmentReservation.findMany(),
    prisma.techIssue.findMany(),
    prisma.training.findMany({ include: { materials: true } }),
    prisma.trainingParticipation.findMany(),
    prisma.report.findMany(),
  ]);
  mkdirSync("backups", { recursive: true });
  const file = `backups/backup-${new Date().toISOString().slice(0, 10)}.json`;
  writeFileSync(file, JSON.stringify({ users, requests, requirements, settings, permissions, notifications, services, assignments, areas, skills, equipment, loans, movements, packages, reservations, issues, trainings, participations, reports }, null, 2));
  console.log(`Copia guardada en ${file}`);
}

main().finally(() => prisma.$disconnect());
