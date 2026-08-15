const SEASONALJOBS_FEED =
  "https://seasonaljobs.dol.gov/feeds/790.json";

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
    const response = await fetch(SEASONALJOBS_FEED, {
      headers: {
        "Accept": "application/json, text/plain, */*",
        "User-Agent": "vagas-mobile-site1"
      }
    });

    const contentType =
      response.headers.get("content-type") || "";

    const body = await response.text();

    if (!response.ok) {
      throw new Error(
        "SeasonalJobs retornou HTTP " + response.status
      );
    }

    let source;

    try {
      source = JSON.parse(body);
    } catch {
      return jsonResponse(
        {
          error: "O feed não retornou JSON válido.",
          contentType,
          preview: body.slice(0, 500),
          jobs: []
        },
        502
      );
    }

    const records = extractRecords(source);

    const jobs = records
      .map((item, index) => normalizeJob(item, index))
      .filter(job => job.title || job.company);

    return jsonResponse({
      updatedAt: new Date().toISOString(),
      source: SEASONALJOBS_FEED,
      contentType,
      sourceFormat: describeFormat(source),
      sourceRecords: records.length,
      total: jobs.length,
      jobs
    });

  } catch (error) {
    return jsonResponse(
      {
        error: "Não foi possível carregar as vagas do SeasonalJobs.",
        details: error.message,
        source: SEASONALJOBS_FEED,
        jobs: []
      },
      502
    );
  }
}

function describeFormat(source) {
  if (Array.isArray(source)) {
    return "array";
  }

  if (source && typeof source === "object") {
    return {
      objectKeys: Object.keys(source).slice(0, 30),
      arrayKeys: Object.keys(source).filter(
        key => Array.isArray(source[key])
      )
    };
  }

  return typeof source;
}

function extractRecords(source) {
  if (Array.isArray(source)) {
    return source;
  }

  if (!source || typeof source !== "object") {
    return [];
  }

  const possibleKeys = [
    "jobs",
    "data",
    "results",
    "records",
    "items",
    "jobOrders",
    "job_orders",
    "offers",
    "opportunities"
  ];

  for (const key of possibleKeys) {
    if (Array.isArray(source[key])) {
      return source[key];
    }
  }

  for (const value of Object.values(source)) {
    if (Array.isArray(value)) {
      return value;
    }
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

  const id = String(firstValue(item, [
    "case_number",
    "caseNumber",
    "job_order_number",
    "jobOrderNumber",
    "job_id",
    "jobId",
    "id"
  ], index + 1));

  return {
    id,
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
