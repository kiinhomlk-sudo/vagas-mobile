const FEEDS = [
  {
    name: "H-2A Job Orders",
    url: "https://seasonaljobs.dol.gov/api/feeds/790"
  },
  {
    name: "H-2A Applications",
    url: "https://seasonaljobs.dol.gov/api/feeds/9142A"
  },
  {
    name: "H-2B Applications",
    url: "https://seasonaljobs.dol.gov/api/feeds/9142B"
  }
];

function first(object, keys, fallback = "") {
  for (const key of keys) {
    if (
      object &&
      object[key] !== undefined &&
      object[key] !== null &&
      object[key] !== ""
    ) {
      return object[key];
    }
  }

  return fallback;
}

function numberValue(value) {
  if (typeof value === "number") return value;
  if (!value) return 0;

  const normalized = String(value)
    .replace(/[$,]/g, "")
    .replace(/[^0-9.]/g, "");

  return Number(normalized) || 0;
}

function normalizeJob(raw, source) {
  const title = first(raw, [
    "job_title",
    "jobTitle",
    "occupation_title",
    "occupationTitle",
    "title"
  ], "Seasonal job");

  const company = first(raw, [
    "employer_name",
    "employerName",
    "employer",
    "company_name",
    "company"
  ], "Employer not specified");

  const city = first(raw, [
    "worksite_city",
    "worksiteCity",
    "city"
  ]);

  const state = first(raw, [
    "worksite_state",
    "worksiteState",
    "state"
  ]);

  const type = source.includes("9142B") ? "H-2B" : "H-2A";

  const wage = numberValue(first(raw, [
    "wage_rate",
    "wageRate",
    "offered_wage",
    "offeredWage",
    "wage"
  ]));

  const salaryMin = numberValue(first(raw, [
    "min_wage",
    "minWage",
    "wage_min",
    "wageMin"
  ], wage));

  const salaryMax = numberValue(first(raw, [
    "max_wage",
    "maxWage",
    "wage_max",
    "wageMax"
  ], wage || salaryMin));

  return {
    id: first(raw, [
      "case_number",
      "caseNumber",
      "job_order_number",
      "jobOrderNumber"
    ], `${type}-${company}-${title}-${city}-${state}`),

    title,
    company,
    city,
    state,
    type,
    salaryMin: salaryMin || salaryMax || 0,
    salaryMax: salaryMax || salaryMin || 0,

    posted: first(raw, [
      "created_at",
      "createdAt",
      "posted_date",
      "postedDate",
      "date_posted"
    ]),

    start: first(raw, [
      "job_start_date",
      "jobStartDate",
      "start_date",
      "startDate"
    ]),

    end: first(raw, [
      "job_end_date",
      "jobEndDate",
      "end_date",
      "endDate"
    ]),

    hours: first(raw, [
      "hours_per_week",
      "hoursPerWeek",
      "hours"
    ], "Not informed"),

    workers: first(raw, [
      "workers_needed",
      "workersNeeded",
      "number_of_workers",
      "numberOfWorkers"
    ], "Not informed"),

    experience: first(raw, [
      "experience",
      "experience_required",
      "experienceRequired"
    ], "Not informed"),

    housing: first(raw, [
      "housing",
      "housing_provided",
      "housingProvided"
    ], "Not informed"),

    transport: first(raw, [
      "transportation",
      "transportation_provided",
      "transportationProvided"
    ], "Not informed"),

    meals: first(raw, [
      "meals",
      "meals_provided",
      "mealsProvided"
    ], "Not informed"),

    tools: first(raw, [
      "tools",
      "tools_provided",
      "toolsProvided"
    ], "Not informed"),

    email: first(raw, [
      "employer_email",
      "employerEmail",
      "email"
    ]),

    description: first(raw, [
      "job_description",
      "jobDescription",
      "description"
    ]),

    caseNumber: first(raw, [
      "case_number",
      "caseNumber",
      "job_order_number",
      "jobOrderNumber"
    ]),

    source,
    sourceUrl: first(raw, [
      "job_url",
      "jobUrl",
      "url",
      "detail_url",
      "detailUrl"
    ])
  };
}

async function readFeed(feed) {
  const response = await fetch(feed.url);

  if (!response.ok) {
    throw new Error(`Feed failed: ${feed.name}`);
  }

  const data = await response.json();

  if (Array.isArray(data)) return data;

  return data.jobs ||
    data.results ||
    data.data ||
    data.items ||
    [];
}

exports.handler = async function() {
  const allJobs = [];
  const errors = [];

  for (const feed of FEEDS) {
    try {
      const records = await readFeed(feed);

      for (const record of records) {
        allJobs.push(normalizeJob(record, feed.url));
      }
    } catch (error) {
      errors.push({
        feed: feed.name,
        message: error.message
      });
    }
  }

  const unique = new Map();

  for (const job of allJobs) {
    unique.set(String(job.id), job);
  }

  const output = {
    updatedAt: new Date().toISOString(),
    total: unique.size,
    errors,
    jobs: Array.from(unique.values())
  };

  return {
    statusCode: errors.length && !output.jobs.length ? 500 : 200,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(output)
  };
};
