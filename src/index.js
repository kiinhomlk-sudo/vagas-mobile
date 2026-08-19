import { unzipSync, strFromU8 } from "fflate";

const DOL_FEED =
  "https://api.seasonaljobs.dol.gov/datahub-search/sjCaseData/zip/jo";

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=300",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function responseJSON(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: HEADERS
  });
}

function clean(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  return value;
}

function number(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const match = String(value)
    .replace(/,/g, "")
    .match(/-?\d+(?:\.\d+)?/);

  return match ? Number(match[0]) : null;
}

function salary(record) {
  const wage = clean(record.jobWageOffer);

  if (wage !== "") {
    const values = String(wage)
      .replace(/,/g, "")
      .match(/\d+(?:\.\d+)?/g);

    if (values?.length >= 2) {
      return {
        min: Number(values[0]),
        max: Number(values[1])
      };
    }

    if (values?.length === 1) {
      const value = Number(values[0]);

      return {
        min: value,
        max: value
      };
    }
  }

  const pieceRate = number(record.jobPieceRate);

  return {
    min: pieceRate,
    max: pieceRate
  };
}

function experience(record) {
  const months = number(record.jobMinexpmonths);

  if (months === null || months <= 0) {
    return "Não exigida";
  }

  return `${months} mês(es) de experiência`;
}

function hours(record) {
  const total = number(record.jobHoursTotal);

  if (total === null) {
    return "Não informado";
  }

  return `${total} horas/semana`;
}

function housing(record) {
  const values = [
    record.housingType,
    record.housingAddr1,
    record.housingAddr2,
    record.housingCity,
    record.housingState,
    record.housingPostcode,
    record.housingCounty,
    record.housingAddInfo
  ]
    .map(clean)
    .filter(Boolean);

  return values.length
    ? values.join(" — ")
    : "Não informado";
}

function transport(record) {
  const values = [
    record.transportDescDaily,
    record.transportDescEmp
  ]
    .map(clean)
    .filter(Boolean);

  const min = number(record.transportMinreimburse);
  const max = number(record.transportMaxreimburse);

  if (min !== null || max !== null) {
    let text = "Reembolso: ";

    if (min !== null) {
      text += `$${min.toFixed(2)}`;
    }

    if (max !== null) {
      text += ` até $${max.toFixed(2)}`;
    }

    values.push(text);
  }

  return values.length
    ? values.join(" — ")
    : "Não informado";
}

function meals(record) {
  const values = [];

  const description =
    clean(record.mealDescription);

  if (description) {
    values.push(description);
  }

  const charged =
    record.mealIsCharged === 1 ||
    record.mealIsCharged === "1";

  if (charged) {
    const charge =
      number(record.mealCharge);

    values.push(
      charge !== null
        ? `Cobrado: $${charge.toFixed(2)}`
        : "Refeição cobrada"
    );
  }

  return values.length
    ? values.join(" — ")
    : "Não informado";
}

function requirements(record) {
  const values = [];

  const additional =
    clean(record.jobAddReqinfo);

  if (additional) {
    values.push(additional);
  }

  const education =
    clean(record.jobMinedu);

  if (education) {
    values.push(`Escolaridade: ${education}`);
  }

  const training =
    number(record.jobMintrainingmonths);

  if (training !== null && training > 0) {
    values.push(
      `Treinamento: ${training} mês(es)`
    );
  }

  if (
    record.jobIsCert === 1 ||
    record.jobIsCert === "1"
  ) {
    values.push("Certificação/licença exigida");
  }

  if (
    record.jobIsDriver === 1 ||
    record.jobIsDriver === "1"
  ) {
    values.push("Requisitos para motorista");
  }

  if (
    record.jobIsBackground === 1 ||
    record.jobIsBackground === "1"
  ) {
    values.push("Verificação de antecedentes");
  }

  if (
    record.jobIsDrugScreen === 1 ||
    record.jobIsDrugScreen === "1"
  ) {
    values.push("Teste de drogas");
  }

  if (
    record.jobIsLifting === 1 ||
    record.jobIsLifting === "1"
  ) {
    const weight =
      number(record.jobLiftingWeight);

    values.push(
      weight !== null
        ? `Exigência de levantamento: ${weight} lbs`
        : "Exigência de levantamento"
    );
  }

  return values.length
    ? values.join(" — ")
    : "Não informado";
}

function description(record) {
  return (
    clean(record.jobDuties) ||
    clean(record.recDetails) ||
    clean(record.jobAddReqinfo) ||
    "Não informado"
  );
}

function posted(record) {
  return (
    clean(record.dateSubmitted) ||
    clean(record.form790AsOfDate) ||
    clean(record.issueDate) ||
    ""
  );
}

function makeId(record) {
  const source =
    clean(record.caseNumber) ||
    clean(record.clearanceOrderNumber);

  if (!source) return null;

  const digits =
    String(source).replace(/\D/g, "");

  if (!digits) return null;

  const id =
    Number(digits.slice(-15));

  return Number.isSafeInteger(id)
    ? id
    : null;
}

function mapJob(record) {
  const caseNumber =
    clean(record.caseNumber);

  if (!caseNumber) return null;

  const pay = salary(record);
  const id = makeId(record);

  if (id === null) return null;

  return {
    id,
    caseNumber,

    title:
      clean(record.jobTitle) ||
      clean(record.socTitle) ||
      "Vaga H-2A",

    company:
      clean(record.empBusinessName) ||
      clean(record.empTradeName) ||
      "Empresa não informada",

    city: clean(record.jobCity),
    state: clean(record.jobState),
    address: clean(record.jobAddr1),
    postcode: clean(record.jobPostcode),
    county: clean(record.jobCounty),

    type: "H-2A",

    description:
      description(record),

    salaryMin: pay.min,
    salaryMax: pay.max,

    wagePer:
      clean(record.jobWagePer),

    pieceRate:
      clean(record.jobPieceRate),

    specialPay:
      clean(record.jobSpecialPayInfo),

    payFrequency:
      clean(record.jobPayFrequency),

    hours:
      hours(record),

    start:
      clean(record.jobBeginDate),

    end:
      clean(record.jobEndDate),

    workers:
      clean(record.jobWrksNeededH2a) ||
      clean(record.jobWrksNeeded),

    experience:
      experience(record),

    requirements:
      requirements(record),

    education:
      clean(record.jobMinedu),

    trainingMonths:
      number(record.jobMintrainingmonths),

    email:
      clean(record.recApplyEmail),

    phone:
      clean(record.recApplyPhone),

    phoneExtension:
      clean(record.recApplyExtension),

    applicationUrl:
      clean(record.recApplyUrl),

    applicationDetails:
      clean(record.recDetails),

    housing:
      housing(record),

    transport:
      transport(record),

    meals:
      meals(record),

    tools:
      clean(record.jobAddReqinfo) ||
      "Não informado",

    posted:
      posted(record),

    socCode:
      clean(record.socCode),

    socTitle:
      clean(record.socTitle),

    updatedAt:
      clean(record.form790AsOfDate),

    sourceUrl:
      `https://seasonaljobs.dol.gov/jobs/${encodeURIComponent(
        caseNumber
      )}`,

    source:
      "U.S. Department of Labor — SeasonalJobs.dol.gov"
  };
}

function collectRecords(value, output = []) {
  if (!value) return output;

  if (Array.isArray(value)) {
    for (const item of value) {
      collectRecords(item, output);
    }

    return output;
  }

  if (typeof value !== "object") {
    return output;
  }

  if (
    value.caseNumber ||
    value.case_number ||
    value.jobTitle ||
    value.job_title ||
    value.jobWrksNeeded ||
    value.clearanceOrderNumber
  ) {
    output.push(value);
    return output;
  }

  for (const key of [
    "data",
    "jobs",
    "results",
    "records",
    "items",
    "jobOrders",
    "job_orders"
  ]) {
    if (value[key]) {
      collectRecords(
        value[key],
        output
      );
    }
  }

  return output;
}

function parseJSON(text) {
  const value = text.trim();

  if (!value) return [];

  try {
    return collectRecords(
      JSON.parse(value)
    );
  } catch {
    const records = [];

    for (
      const line of
      value.split(/\r?\n/)
    ) {
      const row = line.trim();

      if (!row) continue;

      try {
        records.push(
          ...collectRecords(
            JSON.parse(row)
          )
        );
      } catch {
        // Ignora linha inválida.
      }
    }

    return records;
  }
}

/* =========================================================
   DIAGNÓSTICO DO FEED
   ========================================================= */

async function debugFeed() {
  const date = "2026-08-19";

  const url =
    `${DOL_FEED}/${date}`;

  const response =
    await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "Accept": "*/*"
      }
    });

  const bytes =
    new Uint8Array(
      await response.arrayBuffer()
    );

  const firstBytes =
    Array.from(
      bytes.slice(0, 32)
    )
      .map(
        n =>
          n.toString(16)
            .padStart(2, "0")
      )
      .join(" ");

  const isZip =
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b;

  let zipFiles = [];

  let unzipError = null;

  if (isZip) {
    try {
      const files =
        unzipSync(bytes);

      zipFiles =
        Object.entries(files)
          .map(
            ([name, data]) => ({
              name,
              size: data.length
            })
          );
    } catch (error) {
      unzipError =
        error?.message ||
        String(error);
    }
  }

  return {
    ok: true,

    url,

    status:
      response.status,

    statusText:
      response.statusText,

    contentType:
      response.headers.get(
        "content-type"
      ),

    contentLength:
      response.headers.get(
        "content-length"
      ),

    size:
      bytes.length,

    firstBytes,

    isZip,

    zipFiles,

    unzipError
  };
}

/* =========================================================
   DOWNLOAD FEED
   ========================================================= */

async function downloadFeed() {
  const today =
    new Date();

  for (
    let offset = 0;
    offset <= 30;
    offset++
  ) {
    const date =
      new Date(today);

    date.setUTCDate(
      date.getUTCDate() - offset
    );

    const dateString =
      date.toISOString().slice(0, 10);

    const url =
      `${DOL_FEED}/${dateString}`;

    try {
      const response =
        await fetch(url, {
          method: "GET",
          redirect: "follow",
          headers: {
            "Accept": "*/*"
          }
        });

      if (!response.ok) {
        continue;
      }

      const bytes =
        new Uint8Array(
          await response.arrayBuffer()
        );

      if (
        bytes.length < 4 ||
        bytes[0] !== 0x50 ||
        bytes[1] !== 0x4b
      ) {
        continue;
      }

      const files =
        unzipSync(bytes);

      const records = [];

      for (
        const [, fileBytes]
        of Object.entries(files)
      ) {
        if (!fileBytes?.length) {
          continue;
        }

        let text;

        try {
          text =
            strFromU8(fileBytes);
        } catch {
          continue;
        }

        if (!text?.trim()) {
          continue;
        }

        records.push(
          ...parseJSON(text)
        );
      }

      const unique =
        new Map();

      for (
        const record
        of records
      ) {
        const caseNumber =
          clean(
            record.caseNumber ||
            record.case_number
          );

        if (caseNumber) {
          unique.set(
            caseNumber,
            record
          );
        }
      }

      const finalRecords =
        Array.from(
          unique.values()
        );

      if (finalRecords.length) {
        return {
          records:
            finalRecords,

          sourceDate:
            dateString
        };
      }
    } catch (error) {
      console.error(
        `Erro no feed ${dateString}:`,
        error
      );
    }
  }

  throw new Error(
    "Feed 790/790A não encontrado."
  );
}

/* =========================================================
   D1
   ========================================================= */

const JOB_COLUMNS = [
  "id",
  "caseNumber",
  "title",
  "company",
  "city",
  "state",
  "address",
  "postcode",
  "county",
  "type",
  "description",
  "salaryMin",
  "salaryMax",
  "wagePer",
  "pieceRate",
  "specialPay",
  "payFrequency",
  "hours",
  "start",
  "end",
  "workers",
  "experience",
  "requirements",
  "education",
  "trainingMonths",
  "email",
  "phone",
  "phoneExtension",
  "applicationUrl",
  "applicationDetails",
  "housing",
  "transport",
  "meals",
  "tools",
  "posted",
  "socCode",
  "socTitle",
  "updatedAt",
  "sourceUrl",
  "source",
  "syncedAt"
];

const JOB_PLACEHOLDERS =
  JOB_COLUMNS
    .map(() => "?")
    .join(", ");

const JOB_UPDATE_COLUMNS =
  JOB_COLUMNS
    .filter(
      column =>
        column !== "caseNumber"
    )
    .map(
      column =>
        `${column} = excluded.${column}`
    )
    .join(", ");

function jobValues(
  job,
  syncedAt
) {
  return [
    job.id,
    job.caseNumber,
    job.title,
    job.company,
    job.city,
    job.state,
    job.address,
    job.postcode,
    job.county,
    job.type,
    job.description,
    job.salaryMin,
    job.salaryMax,
    job.wagePer,
    job.pieceRate,
    job.specialPay,
    job.payFrequency,
    job.hours,
    job.start,
    job.end,
    job.workers,
    job.experience,
    job.requirements,
    job.education,
    job.trainingMonths,
    job.email,
    job.phone,
    job.phoneExtension,
    job.applicationUrl,
    job.applicationDetails,
    job.housing,
    job.transport,
    job.meals,
    job.tools,
    job.posted,
    job.socCode,
    job.socTitle,
    job.updatedAt,
    job.sourceUrl,
    job.source,
    syncedAt
  ];
}

async function saveJobsToD1(
  env,
  jobs
) {
  if (!jobs.length) {
    return {
      total: 0
    };
  }

  const syncedAt =
    new Date().toISOString();

  const sql = `
    INSERT INTO jobs (
      ${JOB_COLUMNS.join(", ")}
    )
    VALUES (
      ${JOB_PLACEHOLDERS}
    )
    ON CONFLICT(caseNumber)
    DO UPDATE SET
      ${JOB_UPDATE_COLUMNS}
  `;

  const statements =
    jobs.map(job =>
      env.DB
        .prepare(sql)
        .bind(
          ...jobValues(
            job,
            syncedAt
          )
        )
    );

  for (
    let i = 0;
    i < statements.length;
    i += 50
  ) {
    await env.DB.batch(
      statements.slice(i, i + 50)
    );
  }

  return {
    total: jobs.length
  };
}

async function getDatabaseStats(env) {
  const result =
    await env.DB
      .prepare(`
        SELECT
          COUNT(*) AS total,
          MAX(syncedAt) AS updatedAt
        FROM jobs
      `)
      .first();

  return {
    total:
      Number(result?.total || 0),

    updatedAt:
      result?.updatedAt || null
  };
}

async function getJobsFromD1(env) {
  const result =
    await env.DB
      .prepare(`
        SELECT
          id,
          caseNumber,
          title,
          company,
          city,
          state,
          address,
          postcode,
          county,
          type,
          description,
          salaryMin,
          salaryMax,
          wagePer,
          pieceRate,
          specialPay,
          payFrequency,
          hours,
          start,
          end,
          workers,
          experience,
          requirements,
          education,
          trainingMonths,
          email,
          phone,
          phoneExtension,
          applicationUrl,
          applicationDetails,
          housing,
          transport,
          meals,
          tools,
          posted,
          socCode,
          socTitle,
          updatedAt,
          sourceUrl,
          source
        FROM jobs
        ORDER BY id DESC
      `)
      .all();

  return result.results || [];
}

async function updateDatabase(env) {
  const feed =
    await downloadFeed();

  const jobs = [];

  for (
    const record
    of feed.records
  ) {
    const job =
      mapJob(record);

    if (job) {
      jobs.push(job);
    }
  }

  const sync =
    await saveJobsToD1(
      env,
      jobs
    );

  const stats =
    await getDatabaseStats(env);

  return {
    total:
      stats.total,

    sourceDate:
      feed.sourceDate,

    updatedAt:
      stats.updatedAt,

    sync: {
      received:
        feed.records.length,

      processed:
        sync.total
    }
  };
}

/* =========================================================
   WORKER
   ========================================================= */

export default {
  async fetch(
    request,
    env
  ) {
    const url =
      new URL(request.url);

    if (
      request.method === "OPTIONS"
    ) {
      return new Response(null, {
        status: 204,
        headers: HEADERS
      });
    }

    /* NOVA ROTA DE DIAGNÓSTICO */

    if (
      url.pathname === "/debug-feed"
    ) {
      try {
        const data =
          await debugFeed();

        return responseJSON(data);
      } catch (error) {
        return responseJSON(
          {
            ok: false,
            error:
              error?.message ||
              String(error)
          },
          502
        );
      }
    }

    if (
      url.pathname === "/health"
    ) {
      try {
        const stats =
          await getDatabaseStats(env);

        return responseJSON({
          ok: true,
          database: "D1",
          total: stats.total,
          updatedAt: stats.updatedAt
        });
      } catch (error) {
        return responseJSON(
          {
            ok: false,
            database: "D1",
            error:
              error?.message ||
              String(error)
          },
          500
        );
      }
    }

    if (
      url.pathname === "/jobs"
    ) {
      try {
        const jobs =
          await getJobsFromD1(env);

        const stats =
          await getDatabaseStats(env);

        return responseJSON({
          jobs,
          total: stats.total,
          updatedAt: stats.updatedAt,
          source:
            "U.S. Department of Labor — SeasonalJobs.dol.gov"
        });
      } catch (error) {
        return responseJSON(
          {
            error:
              "Não foi possível consultar as vagas no D1.",
            details:
              error?.message ||
              String(error)
          },
          502
        );
      }
    }

    if (
      url.pathname === "/sync"
    ) {
      try {
        const data =
          await updateDatabase(env);

        return responseJSON({
          ok: true,
          total: data.total,
          sync: data.sync,
          sourceDate: data.sourceDate,
          updatedAt: data.updatedAt
        });
      } catch (error) {
        return responseJSON(
          {
            ok: false,
            error:
              error?.message ||
              String(error)
          },
          502
        );
      }
    }

    return responseJSON(
      {
        error:
          "Rota não encontrada"
      },
      404
    );
  },

  async scheduled(
    controller,
    env,
    ctx
  ) {
    ctx.waitUntil(
      updateDatabase(env)
        .catch(error => {
          console.error(
            "Erro na sincronização D1:",
            error
          );
        })
    );
  }
};
