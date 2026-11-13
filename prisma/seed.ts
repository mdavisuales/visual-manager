import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_SETTINGS } from "../src/lib/settings";
import { DEFAULT_ROLE_PERMISSIONS } from "../src/lib/permissions";

const prisma = new PrismaClient();

const DEFAULT_REQUIREMENTS = [
  ["Sonido", "Micrófonos, consola y cabinas"],
  ["Proyección", "Video beam, pantalla y presentaciones"],
  ["Iluminación", "Luces de escenario o ambientales"],
  ["Transmisión en vivo", "Streaming del evento"],
  ["Música o pistas", "Reproducción de audio o pistas"],
];

async function main() {
  // Configuración inicial (no pisa lo que ya exista)
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  // Permisos por defecto: solo se otorgan los que nunca se habían sembrado,
  // así una actualización agrega los permisos nuevos sin pisar lo que el coordinador ya cambió.
  const PHASE1 = ["solicitudes.ver", "solicitudes.gestionar", "avisos.gestionar", "usuarios.ver"];
  const seededRow = await prisma.setting.findUnique({ where: { key: "seeded_permissions" } });
  const hadRows = (await prisma.rolePermission.count()) > 0;
  const seeded = new Set(seededRow ? seededRow.value.split(",") : hadRows ? PHASE1 : []);
  for (const [role, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    for (const permission of perms) {
      if (seeded.has(permission)) continue;
      await prisma.rolePermission.upsert({
        where: { role_permission: { role: role as "LIDER" | "SERVIDOR", permission } },
        update: {},
        create: { role: role as "LIDER" | "SERVIDOR", permission },
      });
    }
  }
  const allKeys = Array.from(new Set([...Array.from(seeded), ...Object.values(DEFAULT_ROLE_PERMISSIONS).flat()]));
  await prisma.setting.upsert({
    where: { key: "seeded_permissions" },
    update: { value: allKeys.join(",") },
    create: { key: "seeded_permissions", value: allKeys.join(",") },
  });

  // Áreas oficiales y habilidades de ejemplo, solo si no hay ninguna
  if ((await prisma.area.count()) === 0) {
    const DEFAULT_AREAS: Record<string, string[]> = {
      Transmisión: ["Operar mezclador de video y streaming", "Configurar la transmisión en vivo"],
      Sonido: ["Operar consola de audio", "Armado de cabinas y cableado", "Microfonía"],
      Iluminación: ["Operar consola de luces", "Montaje de luces"],
      Proyección: ["Operar software de proyección", "Manejo de video beam y pantallas"],
    };
    let order = 1;
    for (const [name, list] of Object.entries(DEFAULT_AREAS)) {
      const area = await prisma.area.create({ data: { name, sortOrder: order++ } });
      for (const skill of list) await prisma.skill.create({ data: { name: skill, areaId: area.id } });
    }
  }

  // Categorías de inventario de ejemplo, solo si no hay ninguna
  if ((await prisma.equipmentCategory.count()) === 0) {
    let n = 1;
    for (const name of ["Sonido", "Proyección", "Iluminación", "Transmisión", "Cableado y accesorios", "Otros"]) {
      await prisma.equipmentCategory.create({ data: { name, sortOrder: n++ } });
    }
  }

  // Requerimientos técnicos de ejemplo, solo si no hay ninguno
  if ((await prisma.techRequirement.count()) === 0) {
    let i = 1;
    for (const [name, description] of DEFAULT_REQUIREMENTS) {
      await prisma.techRequirement.create({ data: { name, description, sortOrder: i++ } });
    }
  }

  // Primer coordinador
  const email = process.env.COORDINATOR_EMAIL?.trim().toLowerCase();
  const password = process.env.COORDINATOR_PASSWORD;
  if (!email || !password || password.length < 8) {
    throw new Error("Define COORDINATOR_EMAIL y COORDINATOR_PASSWORD (mínimo 8 caracteres) en tu archivo .env");
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`El usuario ${email} ya existe; no se modificó.`);
  } else {
    await prisma.user.create({
      data: {
        email,
        name: process.env.COORDINATOR_NAME || "Coordinador",
        phone: process.env.COORDINATOR_PHONE || null,
        role: "COORDINADOR",
        passwordHash: await bcrypt.hash(password, 10),
      },
    });
    console.log(`Coordinador creado: ${email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
