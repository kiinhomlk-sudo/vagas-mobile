import { unzipSync, strFromU8 } from "fflate";

const DOL_FEED =
  "https://api.seasonaljobs.dol.gov/datahub-search/sjCaseData/zip/jo";

const CACHE_KEY = "seasonaljobs-790a-json";

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

  if (typeof value === "string") {
    return value.trim();
  }

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
    return Number.isFinite(value)
      ? value
      : null;
  }

  const match = String(value)
    .replace(/,/g, "")
    .match(/-?\d+(?:\.\d+)?/);

  return match
    ? Number(match[0])
    : null;
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

  const pieceRate =
    number(record.jobPieceRate);

  return {
    min: pieceRate,
    max: pieceRate
  };
}

function experience(record) {
  const months =
    number(record.jobMinexpmonths);

  if (
    months === null ||
    months <= 0
  ) {
    return "Não exigida";
  }

  return `${months} mês(es) de experiência`;
}

function hours(record) {
  const total =
    number(record.jobHoursTotal);

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

  const min =
    number(record.transportMinreimburse);

  const max =
    number(record.transportMaxreimburse);

  if (
    min !== null ||
    max !== null
  ) {
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

  if (
    training !== null &&
    training > 0
  ) {
    values.push(
      `Treinamento: ${training} mês(es)`
    );
  }

  if (
    record.jobIsCert === 1 ||
    record.jobIsCert === "1"
  ) {
    values.push(
      "Certificação/licença exigida"
    );
  }

  if (
    record.jobIsDriver === 1 ||
    record.jobIsDriver === "1"
  ) {
    values.push(
      "Requisitos para motorista"
    );
  }

  if (
    record.jobIsBackground === 1 ||
    record.jobIsBackground === "1"
  ) {
    values.push(
      "Verificação de antecedentes"
    );
  }

  if (
    record.jobIsDrugScreen === 1 ||
    record.jobIsDrugScreen === "1"
  ) {
    values.push(
      "Teste de drogas"
    );
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

  if (!source) {
    return null;
  }

  const digits =
    String(source).replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  const id =
    Number(digits.slice(-15));

  return Number.isSafeInteger(id)
    ? id
    : null;
}

function mapJob(record) {
  const caseNumber =
    clean(record.caseNumber);

  if (!caseNumber) {
    return null;
  }

  const pay =
    salary(record);

  const id =
    makeId(record);

  if (id === null) {
    return null;
  }

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

    city:
      clean(record.jobCity),

    state:
      clean(record.jobState),

    address:
      clean(record.jobAddr1),

    postcode:
      clean(record.jobPostcode),

    county:
      clean(record.jobCounty),

    type: "H-2A",

    description:
      description(record),

    salaryMin:
      pay.min,

    salaryMax:
      pay.max,

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

function collectRecords(
  value,
  output = []
) {
  if (!value) {
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectRecords(item, output);
    }

    return output;
  }

  if (
    typeof value !== "object"
  ) {
    return output;
  }

  if (
    value.caseNumber ||
    value.jobTitle ||
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
    "jobOrders"
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
  const value =
    text.trim();

  if (!value) {
    return [];
  }

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
      const row =
        line.trim();

      if (!row) {
        continue;
      }

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

async function downloadFeed() {
  const today =
    new Date();

  for (
    let offset = 0;
    offset <= 2;
    offset++
  ) {
    const date =
      new Date(today);

    date.setUTCDate(
      date.getUTCDate() - offset
    );

    const dateString =
      date.toISOString()
        .slice(0, 10);

    const url =
      `${DOL_FEED}/${dateString}`;

    const response =
      await fetch(url, {
        headers: {
          "Accept":
            "application/zip,application/octet-stream"
        }
      });

    if (!response.ok) {
      continue;
    }

    const zip =
      new Uint8Array(
        await response.arrayBuffer()
      );

    const files =
      unzipSync(zip);

    const records = [];

    for (
      const [filename, bytes]
      of Object.entries(files)
    ) {
      const lower =
        filename.toLowerCase();

      if (
        !lower.endsWith(".json") &&
        !lower.endsWith(".ndjson") &&
        !lower.endsWith(".txt") &&
        !lower.endsWith(".dat")
      ) {
        continue;
      }

      records.push(
        ...parseJSON(
          strFromU8(bytes)
        )
      );
    }

    if (records.length) {
      return {
        records,
        sourceDate:
          dateString
      };
    }
  }

  throw new Error(
    "Feed 790/790A não encontrado."
  );
}

async function getCache(env) {
  const value =
    await env.JOBS.get(
      CACHE_KEY
    );

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function updateCache(env) {
  const feed =
    await downloadFeed();

  const existing =
    await getCache(env);

  const jobs =
    new Map();

  /*
   * Mantém a base existente.
   * Isso é importante porque o feed oficial
   * representa uma janela móvel de 20 dias.
   */
  if (
    existing &&
    Array.isArray(existing.jobs)
  ) {
    for (
      const job
      of existing.jobs
    ) {
      if (job.caseNumber) {
        jobs.set(
          job.caseNumber,
          job
        );
      }
    }
  }

  let inserted = 0;
  let updated = 0;

  for (
    const record
    of feed.records
  ) {
    const job =
      mapJob(record);

    if (!job) {
      continue;
    }

    if (
      jobs.has(job.caseNumber)
    ) {
      updated++;
    } else {
      inserted++;
    }

    jobs.set(
      job.caseNumber,
      job
    );
  }

  const finalJobs =
    Array.from(jobs.values());

  const data = {
    jobs: finalJobs,

    total:
      finalJobs.length,

    updatedAt:
      new Date().toISOString(),

    sourceDate:
      feed.sourceDate,

    sync: {
      received:
        feed.records.length,

      inserted,

      updated
    },

    source:
      "U.S. Department of Labor — SeasonalJobs.dol.gov"
  };

  await env.JOBS.put(
    CACHE_KEY,
    JSON.stringify(data)
  );

  return data;
}

export default {
  async fetch(
    request,
    env
  ) {
    const url =
      new URL(request.url);

    if (
      request.method ===
      "OPTIONS"
    ) {
      return new Response(
        null,
        {
          status: 204,
          headers: HEADERS
        }
      );
    }

    if (
      url.pathname ===
      "/jobs"
    ) {
      let data =
        await getCache(env);

      if (!data) {
        try {
          data =
            await updateCache(env);
        } catch (error) {
          return responseJSON(
            {
              error:
                "Não foi possível carregar as vagas.",
              details:
                error?.message ||
                String(error)
            },
            502
          );
        }
      }

      return responseJSON(
        data
      );
    }

    if (
      url.pathname ===
      "/sync"
    ) {
      try {
        const data =
          await updateCache(env);

        return responseJSON({
          ok: true,
          total: data.total,
          sync: data.sync,
          sourceDate:
            data.sourceDate,
          updatedAt:
            data.updatedAt
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

    if (
      url.pathname ===
      "/health"
    ) {
      const data =
        await getCache(env);

      return responseJSON({
        ok: true,

        cached:
          Boolean(data),

        total:
          data?.total || 0,

        updatedAt:
          data?.updatedAt || null,

        sourceDate:
          data?.sourceDate || null
      });
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
      updateCache(env)
        .catch(error => {
          console.error(
            "Erro na sincronização:",
            error
          );
        })
    );
  }
};
