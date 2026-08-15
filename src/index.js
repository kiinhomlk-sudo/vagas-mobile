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
  return typeof value === "string" ? value.trim() : value;
}

function number(value) {
  if (value === null || value === undefined || value === "") {
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
  const value = record.jobWageOffer;

  if (value !== null && value !== undefined) {
    const values = String(value)
      .replace(/,/g, "")
      .match(/\d+(?:\.\d+)?/g);

    if (values?.length >= 2) {
      return {
        min: Number(values[0]),
        max: Number(values[1])
      };
    }

    if (values?.length === 1) {
      const n = Number(values[0]);

      return {
        min: n,
        max: n
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
  const value = number(record.jobHoursTotal);

  return value !== null
    ? `${value} horas/semana`
    : "Não informado";
}

function housing(record) {
  const values = [
    record.housingType,
    record.housingAddr1,
    record.housingAddr2,
    record.housingCity,
    record.housingState,
    record.housingPostcode,
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
    values.push(
      `Reembolso: ${
        min !== null ? `$${min.toFixed(2)}` : ""
      }${
        max !== null ? ` até $${max.toFixed(2)}` : ""
      }`
    );
  }

  return values.length
    ? values.join(" — ")
    : "Não informado";
}

function meals(record) {
  const values = [];

  if (record.mealDescription) {
    values.push(clean(record.mealDescription));
  }

  const charged =
    record.mealIsCharged === 1 ||
    record.mealIsCharged === "1";

  if (charged) {
    const charge = number(record.mealCharge);

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

function tools(record) {
  return clean(record.jobAddReqinfo) || "Não informado";
}

function description(record) {
  return (
    clean(record.jobDuties) ||
    clean(record.jobAddReqinfo) ||
    "Não informado"
  );
}

function posted(record) {
  return (
    clean(record.dateSubmitted) ||
    clean(record.issueDate) ||
    clean(record.form790AsOfDate) ||
    ""
  );
}

function makeId(record, index) {
  const source =
    clean(record.caseNumber) ||
    clean(record.clearanceOrderNumber) ||
    String(index + 1);

  const digits = String(source).replace(/\D/g, "");

  if (digits) {
    const id = Number(digits.slice(-15));

    if (Number.isSafeInteger(id)) {
      return id;
    }
  }

  return index + 1;
}

function mapJob(record, index) {
  const pay = salary(record);

  return {
    id: makeId(record, index),

    caseNumber: clean(record.caseNumber),

    title:
      clean(record.jobTitle) ||
      clean(record.socTitle) ||
      "Vaga H-2A",

    company:
      clean(record.empBusinessName) ||
      clean(record.empTradeName) ||
      "Empresa não informada",

    city:
      clean(record.jobCity) ||
      clean(record.emppocCity),

    state:
      clean(record.jobState) ||
      clean(record.emppocState),

    type: "H-2A",

    description: description(record),

    salaryMin: pay.min,
    salaryMax: pay.max,

    hours: hours(record),

    start: clean(record.jobBeginDate),
    end: clean(record.jobEndDate),

    workers:
      clean(record.jobWrksNeeded) ||
      clean(record.jobWrksNeededH2a),

    experience: experience(record),

    email:
      clean(record.recApplyEmail) ||
      clean(record.emppocEmail) ||
      clean(record.emppocAddEmail),

    housing: housing(record),

    transport: transport(record),

    meals: meals(record),

    tools: tools(record),

    posted: posted(record),

    applicationUrl: clean(record.recApplyUrl),

    phone: clean(record.recApplyPhone),

    socCode: clean(record.socCode),

    socTitle: clean(record.socTitle),

    wagePer: clean(record.jobWagePer),

    pieceRate: clean(record.jobPieceRate),

    specialPay: clean(record.jobSpecialPayInfo),

    requirements: clean(record.jobAddReqinfo)
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
      collectRecords(value[key], output);
    }
  }

  return output;
}

function parseJSON(text) {
  const value = text.trim();

  if (!value) return [];

  try {
    return collectRecords(JSON.parse(value));
  } catch {
    const records = [];

    for (const line of value.split(/\r?\n/)) {
      const row = line.trim();

      if (!row) continue;

      try {
        records.push(
          ...collectRecords(JSON.parse(row))
        );
      } catch {
        // Ignora linhas inválidas.
      }
    }

    return records;
  }
}

async function downloadFeed() {
  const today = new Date();

  for (let offset = 0; offset <= 2; offset++) {
    const date = new Date(today);

    date.setUTCDate(
      date.getUTCDate() - offset
    );

    const dateString =
      date.toISOString().slice(0, 10);

    const url = `${DOL_FEED}/${dateString}`;

    const response = await fetch(url);

    if (!response.ok) continue;

    const zip = new Uint8Array(
      await response.arrayBuffer()
    );

    const files = unzipSync(zip);

    const records = [];

    for (const [filename, bytes] of Object.entries(files)) {
      const lower = filename.toLowerCase();

      if (
        !lower.endsWith(".json") &&
        !lower.endsWith(".ndjson") &&
        !lower.endsWith(".txt") &&
        !lower.endsWith(".dat")
      ) {
        continue;
      }

      records.push(
        ...parseJSON(strFromU8(bytes))
      );
    }

    if (records.length) {
      return {
        records,
        sourceDate: dateString
      };
    }
  }

  throw new Error(
    "Feed 790/790A não encontrado."
  );
}

async function updateCache(env) {
  const feed = await downloadFeed();

  const jobs = feed.records
    .map((record, index) =>
      mapJob(record, index)
    )
    .filter(job => job.title);

  const data = {
    jobs,
    total: jobs.length,
    updatedAt: new Date().toISOString(),
    sourceDate: feed.sourceDate,
    source:
      "U.S. Department of Labor — SeasonalJobs.dol.gov"
  };

  await env.JOBS.put(
    CACHE_KEY,
    JSON.stringify(data)
  );

  return data;
}

async function getCache(env) {
  const value =
    await env.JOBS.get(CACHE_KEY);

  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env) {
    const url =
      new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: HEADERS
      });
    }

    if (url.pathname === "/jobs") {
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
              details: error.message
            },
            502
          );
        }
      }

      return responseJSON(data);
    }

    if (url.pathname === "/health") {
      const data =
        await getCache(env);

      return responseJSON({
        ok: true,
        cached: Boolean(data),
        total: data?.total || 0,
        updatedAt:
          data?.updatedAt || null
      });
    }

    return responseJSON(
      {
        error: "Rota não encontrada"
      },
      404
    );
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      updateCache(env).catch(error => {
        console.error(
          "Erro na atualização automática:",
          error
        );
      })
    );
  }
};
