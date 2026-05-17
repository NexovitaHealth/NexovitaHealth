import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Superadmin
  const superHash = await bcrypt.hash("Admin@123!", 12);
  await prisma.user.upsert({
    where: { email: "superadmin@nexovita.health" },
    update: {},
    create: {
      email: "superadmin@nexovita.health",
      passwordHash: superHash,
      fullName: "Platform Admin",
      role: "superadmin",
      emailVerified: true,
    },
  });

  // Demo organisation
  const org = await prisma.organization.upsert({
    where: { slug: "sunrise-health" },
    update: {},
    create: {
      name: "Sunrise Health Agency",
      slug: "sunrise-health",
      email: "admin@sunrise.health",
      phone: "+1-555-0100",
      city: "Los Angeles",
      region: "CA",
      country: "us",
      careSettings: ["home_care", "hospice"],
      subscriptionTier: "agency",
      settings: {
        create: {
          primaryCareSetting: "home_care",
          onboardingCompleted: true,
          features: { labs: true, scheduling: true, telehealth: false },
        },
      },
    },
  });

  // Agency Admin  (OrgRole: owner)
  const adminHash = await bcrypt.hash("Admin@123!", 12);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@sunrise.health" },
    update: {},
    create: {
      email: "admin@sunrise.health",
      passwordHash: adminHash,
      fullName: "Sarah Johnson",
      role: "agency_admin",
      emailVerified: true,
    },
  });

  // OrgRole enum: owner | admin | member | guest
  await prisma.orgMembership.upsert({
    where: { userId_orgId: { userId: adminUser.id, orgId: org.id } },
    update: {},
    create: {
      userId: adminUser.id,
      orgId: org.id,
      role: "owner",
      isPrimary: true,
    },
  });

  // Supervisor  (OrgRole: admin)
  const supHash = await bcrypt.hash("Admin@123!", 12);
  const supervisor = await prisma.user.upsert({
    where: { email: "supervisor@sunrise.health" },
    update: {},
    create: {
      email: "supervisor@sunrise.health",
      passwordHash: supHash,
      fullName: "Michael Chen",
      role: "supervisor",
      emailVerified: true,
    },
  });

  await prisma.orgMembership.upsert({
    where: { userId_orgId: { userId: supervisor.id, orgId: org.id } },
    update: {},
    create: {
      userId: supervisor.id,
      orgId: org.id,
      role: "admin",
      isPrimary: true,
    },
  });

  // Aide  (OrgRole: member)
  const aideHash = await bcrypt.hash("Admin@123!", 12);
  const aide = await prisma.user.upsert({
    where: { email: "aide@sunrise.health" },
    update: {},
    create: {
      email: "aide@sunrise.health",
      passwordHash: aideHash,
      fullName: "Maria Garcia",
      role: "aide",
      emailVerified: true,
    },
  });

  await prisma.orgMembership.upsert({
    where: { userId_orgId: { userId: aide.id, orgId: org.id } },
    update: {},
    create: { userId: aide.id, orgId: org.id, role: "member", isPrimary: true },
  });

  // Physician  (OrgRole: member)
  const drHash = await bcrypt.hash("Admin@123!", 12);
  const physician = await prisma.user.upsert({
    where: { email: "physician@sunrise.health" },
    update: {},
    create: {
      email: "physician@sunrise.health",
      passwordHash: drHash,
      fullName: "Dr. James Okafor",
      role: "physician",
      emailVerified: true,
    },
  });

  await prisma.orgMembership.upsert({
    where: { userId_orgId: { userId: physician.id, orgId: org.id } },
    update: {},
    create: {
      userId: physician.id,
      orgId: org.id,
      role: "member",
      isPrimary: true,
    },
  });

  // Demo Patients
  const patientRows = [
    {
      fullName: "Eleanor Whitfield",
      dateOfBirth: new Date("1942-03-15"),
      gender: "female",
      primaryDiagnosis: "CHF - Congestive Heart Failure",
      riskLevel: "high" as const,
      status: "active" as const,
      isHomeCare: true,
      isHospice: false,
    },
    {
      fullName: "Robert Martinez",
      dateOfBirth: new Date("1958-07-22"),
      gender: "male",
      primaryDiagnosis: "COPD - Chronic Obstructive Pulmonary Disease",
      riskLevel: "medium" as const,
      status: "active" as const,
      isHomeCare: true,
      isHospice: false,
    },
    {
      fullName: "Dorothy Thompson",
      dateOfBirth: new Date("1935-11-08"),
      gender: "female",
      primaryDiagnosis: "Dementia with behavioral disturbance",
      riskLevel: "critical" as const,
      status: "active" as const,
      isHomeCare: false,
      isHospice: true,
    },
    {
      fullName: "James Williams",
      dateOfBirth: new Date("1965-04-30"),
      gender: "male",
      primaryDiagnosis: "Type 2 Diabetes with neuropathy",
      riskLevel: "medium" as const,
      status: "active" as const,
      isHomeCare: true,
      isHospice: false,
    },
    {
      fullName: "Patricia Davis",
      dateOfBirth: new Date("1950-09-17"),
      gender: "female",
      primaryDiagnosis: "Post-surgical rehabilitation",
      riskLevel: "low" as const,
      status: "active" as const,
      isHomeCare: true,
      isHospice: false,
    },
  ];

  const createdPatientIds: string[] = [];
  for (const p of patientRows) {
    const patient = await prisma.patient.create({
      data: {
        orgId: org.id,
        fullName: p.fullName,
        dateOfBirth: p.dateOfBirth,
        gender: p.gender,
        primaryDiagnosis: p.primaryDiagnosis,
        riskLevel: p.riskLevel,
        status: p.status,
        isHomeCare: p.isHomeCare,
        isHospice: p.isHospice,
        admissionDate: new Date(),
      },
    });
    createdPatientIds.push(patient.id);
  }

  // Vitals for Eleanor (CHF, high risk)
  const eleanorId = createdPatientIds[0];
  if (eleanorId) {
    await prisma.patientVital.createMany({
      data: [
        {
          patientId: eleanorId,
          recordedById: aide.id,
          systolicBp: 158,
          diastolicBp: 94,
          heartRate: 88,
          oxygenSaturation: 94,
          temperature: 98.6,
          weight: 165,
          recordedAt: new Date(Date.now() - 1000 * 60 * 120),
        },
        {
          patientId: eleanorId,
          recordedById: aide.id,
          systolicBp: 172,
          diastolicBp: 98,
          heartRate: 96,
          oxygenSaturation: 91,
          temperature: 99.1,
          weight: 166,
          recordedAt: new Date(Date.now() - 1000 * 60 * 60 * 26),
        },
      ],
    });
    await prisma.clinicalAlert.create({
      data: {
        patientId: eleanorId,
        severity: "critical",
        alertType: "vital_threshold",
        title: "Critical: Elevated BP and low SpO2",
        body: "Systolic BP 172 mmHg elevated. SpO2 91% - below threshold. Reassess.",
        isResolved: false,
      },
    });
  }

  // Vitals for Robert (COPD)
  const robertId = createdPatientIds[1];
  if (robertId) {
    await prisma.patientVital.create({
      data: {
        patientId: robertId,
        recordedById: aide.id,
        systolicBp: 128,
        diastolicBp: 82,
        heartRate: 78,
        oxygenSaturation: 93,
        temperature: 98.4,
        recordedAt: new Date(Date.now() - 1000 * 60 * 240),
      },
    });
  }

  // Project + Kanban columns
  const project = await prisma.project.create({
    data: {
      orgId: org.id,
      name: "Q2 Care Quality Initiative",
      description:
        "Improve patient outcomes and reduce hospital readmission rates.",
      status: "active",
      createdById: adminUser.id,
      columns: {
        create: [
          { name: "Backlog", position: 0, color: "#94a3b8" },
          { name: "In Progress", position: 1, color: "#3b82f6" },
          { name: "In Review", position: 2, color: "#f59e0b" },
          { name: "Done", position: 3, color: "#22c55e" },
        ],
      },
    },
    include: { columns: true },
  });

  const backlog = project.columns.find(
    (c: { name: string }) => c.name === "Backlog",
  )!;
  const inProgress = project.columns.find(
    (c: { name: string }) => c.name === "In Progress",
  )!;
  const done = project.columns.find(
    (c: { name: string }) => c.name === "Done",
  )!;

  // TaskStatus enum: pending | in_progress | completed | cancelled
  await prisma.task.createMany({
    data: [
      {
        orgId: org.id,
        projectId: project.id,
        columnId: backlog.id,
        title: "Update care plans for high-risk patients",
        description:
          "Review and update care plans for all patients rated high or critical before end of quarter.",
        status: "pending",
        priority: "high",
        createdById: adminUser.id,
        labels: ["clinical", "urgent"],
        position: 0,
      },
      {
        orgId: org.id,
        projectId: project.id,
        columnId: inProgress.id,
        title: "Staff training on new vitals protocol",
        description:
          "Complete training sessions for all aides on the updated BP and SpO₂ recording protocol.",
        status: "in_progress",
        priority: "medium",
        createdById: supervisor.id,
        labels: ["training"],
        position: 0,
      },
      {
        orgId: org.id,
        projectId: project.id,
        columnId: backlog.id,
        title: "Review medication reconciliation process",
        description:
          "Audit current workflow and identify gaps per CMS guidelines.",
        status: "pending",
        priority: "medium",
        createdById: adminUser.id,
        labels: ["medications", "compliance"],
        position: 1,
      },
      {
        orgId: org.id,
        projectId: project.id,
        columnId: done.id,
        title: "Onboard Sunrise Health to Nexovita",
        description:
          "Configure agency settings, import patient records, set up user accounts.",
        status: "completed",
        priority: "urgent",
        createdById: adminUser.id,
        labels: ["onboarding"],
        position: 0,
      },
    ],
  });

  // Audit log seed entries
  await prisma.auditLog.createMany({
    data: [
      {
        orgId: org.id,
        actorId: adminUser.id,
        action: "created",
        resourceType: "organization",
        resourceId: org.id,
        metadata: { name: "Sunrise Health Agency" },
      },
      {
        orgId: org.id,
        actorId: adminUser.id,
        action: "created",
        resourceType: "project",
        resourceId: project.id,
        metadata: { name: "Q2 Care Quality Initiative" },
      },
      {
        orgId: org.id,
        actorId: adminUser.id,
        action: "invited",
        resourceType: "user",
        resourceId: supervisor.id,
        metadata: { email: "supervisor@sunrise.health", orgRole: "admin" },
      },
      {
        orgId: org.id,
        actorId: adminUser.id,
        action: "invited",
        resourceType: "user",
        resourceId: aide.id,
        metadata: { email: "aide@sunrise.health", orgRole: "member" },
      },
    ],
  });

  console.log("\n✅ Seed complete!\n");
  console.log("📋 Demo accounts (password: Admin@123!)");
  console.log("   Agency Admin  →  admin@sunrise.health");
  console.log("   Supervisor    →  supervisor@sunrise.health");
  console.log("   Aide          →  aide@sunrise.health");
  console.log("   Physician     →  physician@sunrise.health");
  console.log(`\n🏥 Org: Sunrise Health Agency  (slug: sunrise-health)`);
  console.log(
    `👥 ${patientRows.length} patients · 4 tasks · 1 project · vitals + alerts seeded\n`,
  );
}

main()
  .catch((e) => {
    console.error("\n❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
