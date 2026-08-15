const SEASONALJOBS_BASE =
  "https://api.seasonaljobs.dol.gov/datahub-search/sjCaseData/zip/jo/";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/jobs") {
      return loadSeasonalJobs();
    }

    return env.ASSETS.fetch(request);
  }
};

async function loadSeasonalJobs() {
  try {
    const date = getEasternDate();

    const feedUrl =
      SEASONALJOBS_BASE + date;

    const response = await fetch(feedUrl, {
      headers: {
        "Accept": "application/zip, application/octet-stream, */*",
        "User-Agent": "vagas-mobile-site1"
      }
    });

    if (!response.ok) {
      throw new Error(
        "SeasonalJobs retornou HTTP " + response.status
      );
    }

    const zipBuffer = await response.arrayBuffer();

    const zip = await unzip(zipBuffer);

    const records = [];

    for (const file of zip) {
      const name = file.name.toLowerCase();

      if (
        name.endsWith(".json") ||
        name.endsWith(".jsonl")
      ) {
        const text = await file.text();
        records.push(...parseRecords(text));
      }
    }

    const jobs = records
      .map((item, index) => normalizeJob(item, index))
      .filter(job => job.title || job.company);

    return jsonResponse({
      updatedAt: new Date().toISOString(),
      source: feedUrl,
      sourceRecords: records.length,
      total: jobs.length,
      jobs
    });

  } catch (error) {
    return jsonResponse(
      {
        error: "Não foi possível carregar as vagas do SeasonalJobs.",
        details: error.message,
        jobs: []
      },
      502
    );
  }
}

function getEasternDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

async function unzip(buffer) {
  const blob = new Blob([buffer]);

  if (!("DecompressionStream" in globalThis)) {
    throw new Error(
      "Este Worker não possui suporte nativo para ZIP."
    );
  }

  throw new Error(
    "O arquivo recebido é ZIP e precisa ser processado com uma biblioteca ZIP."
  );
}

function parseRecords(text) {
  const trimmed = text.trim();

  if (!trimmed) {
    return [];
  }

  try {
    const json = JSON.parse(trimmed);

    if (Array.isArray(json)) {
      return json;
    }

    if (json && typeof json === "object") {
      for (const value of Object.values(json)) {
        if (Array.isArray(value)) {
          return value;
        }
      }

      return [json];
    }
  } catch {
    return trimmed
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  return [];
}

function firstValue(item, keys, fallback = "") {
  for (const key of keys) {
    const value = item?.[key];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      return value;
    }
  }

  return fallback;
}

function numberValue(value, fallback = 0) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  const normalized = String(value ?? "")
    .replace("$", "")
    .replace(",", ".")
    .trim();

  const number = Number(normalized);

  return Number.isFinite(number) ? number : fallback;
}

function normalizeJob(item, index) {
  const title = firstValue(item, [
    "job_title",
    "jobTitle",
    "title",
    "occupation_title",
    "occupationTitle",
    "job_order_title",
    "jobOrderTitle"
  ], "Vaga sazonal");

  const company = firstValue(item, [
    "employer_name",
    "employerName",
    "employer",
    "company",
    "employer_business_name",
    "employerBusinessName"
  ], "Empregador não informado");

  const city = firstValue(item, [
    "worksite_city",
    "worksiteCity",
    "city",
    "area_of_employment",
    "areaOfEmployment"
  ], "Local não informado");

  const state = firstValue(item, [
    "worksite_state",
    "worksiteState",
    "state",
    "state_code",
    "stateCode"
  ], "");

  const salaryMin = numberValue(firstValue(item, [
    "wage_rate_from",
    "wageRateFrom",
    "wage_from",
    "wageFrom",
    "min_wage",
    "minWage",
    "salary_min",
    "salaryMin",
    "minimum_wage",
    "minimumWage"
  ]));

  const salaryMax = numberValue(firstValue(item, [
    "wage_rate_to",
    "wageRateTo",
    "wage_to",
    "wageTo",
    "max_wage",
    "maxWage",
    "salary_max",
    "salaryMax",
    "maximum_wage",
    "maximumWage"
  ]), salaryMin);

  return {
    id: String(firstValue(item, [
      "case_number",
      "caseNumber",
      "job_order_number",
      "jobOrderNumber",
      "job_id",
      "jobId",
      "id"
    ], index + 1)),

    title: String(title),
    company: String(company),
    city: String(city),
    state: String(state),
    type: "H-2A",
    salaryMin,
    salaryMax,

    posted: String(firstValue(item, [
      "date_posted",
      "datePosted",
      "posted_date",
      "posting_date"
    ], "")),

    start: String(firstValue(item, [
      "employment_start_date",
      "employmentStartDate",
      "start_date",
      "startDate"
    ], "")),

    end: String(firstValue(item, [
      "employment_end_date",
      "employmentEndDate",
      "end_date",
      "endDate"
    ], "")),

    hours: String(firstValue(item, [
      "hours_per_week",
      "hoursPerWeek",
      "hours"
    ], "Não informado")),

    workers: String(firstValue(item, [
      "workers_needed",
      "workersNeeded",
      "number_of_workers",
      "numberOfWorkers"
    ], "Não informado")),

    experience: String(firstValue(item, [
      "experience_required",
      "experienceRequired",
      "experience"
    ], "Não informado")),

    housing: String(firstValue(item, [
      "housing",
      "housing_provided",
      "housingProvided"
    ], "Não informado")),

    transport: String(firstValue(item, [
      "transportation",
      "transport",
      "transportation_provided",
      "transportationProvided"
    ], "Não informado")),

    meals: String(firstValue(item, [
      "meals",
      "meals_provided",
      "mealsProvided"
    ], "Não informado")),

    tools: String(firstValue(item, [
      "tools",
      "tools_provided",
      "toolsProvided"
    ], "Não informado")),

    email: String(firstValue(item, [
      "contact_email",
      "contactEmail",
      "email",
      "employer_email",
      "employerEmail"
    ], "")),

    description: String(firstValue(item, [
      "job_description",
      "jobDescription",
      "description",
      "job_duties",
      "jobDuties"
    ], "Descrição não informada")),

    originalUrl: String(firstValue(item, [
      "url",
      "job_url",
      "jobUrl",
      "details_url",
      "detailsUrl"
    ], ""))
  };
}

function jsonResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data, null, 2),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store"
      }
    }
  );
}
