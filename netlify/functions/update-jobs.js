const { getStore } = require("@netlify/blobs");

const FEEDS = [
  {
    name: "H-2A Job Orders",
    url: "https://api.seasonaljobs.dol.gov/datahub-search/sjCaseData/zip/jo/2026-08-14"
  },
  {
    name: "H-2A Applications",
    url: "https://api.seasonaljobs.dol.gov/datahub-search/sjCaseData/zip/h2a/2026-08-14"
  },
  {
    name: "H-2B Applications",
    url: "https://api.seasonaljobs.dol.gov/datahub-search/sjCaseData/zip/h2b/2026-08-14"
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
  const type = source.includes("9142B") ? "H-2B" : "H-2A";

  const title = first(raw, [
    "jobTitle",
    "job_title",
    "occupationTitle",
    "occupation_title"
  ], "Seasonal job");

  const company = first(raw, [
    "employerName",
    "employer_name",
    "companyName",
    "company_name"
  ], "Employer not specified");

  const state = first(raw, [
    "workState",
    "worksiteState",
    "worksite_state",
    "state"
  ]);

  const city = first(raw, [
    "workCity",
    "worksiteCity",
    "worksite_city",
    "city"
  ]);

  const wage = numberValue(first(raw, [
    "wageRate",
    "wage_rate",
    "offeredWage",
    "offered_wage"
  ]));

  return {
    id: raw.caseNumber,
    caseNumber: raw.caseNumber,
    title,
    company,
    city,
    state,
    type,

    salaryMin: wage,
    salaryMax: wage,

    posted: first(raw, [
      "jobPostedDate",
      "jobPosted",
      "postedDate",
      "createdAt"
    ]),

    start: first(raw, [
      "jobBeginDate",
      "jobStartDate",
      "startDate"
    ]),

    end: first(raw, [
      "jobEndDate",
      "endDate"
    ]),

    hours: first(raw, [
      "jobHoursTotal",
      "hoursPerWeek",
      "hours"
    ], "Not informed"),

    workers: first(raw, [
      "jobWrksNeededH2a",
      "jobWrksNeeded",
      "workersNeeded"
    ], "Not informed"),

    experience: first(raw, [
      "jobExperience",
      "experienceRequired",
      "experience"
    ], "Not informed"),

    housing: first(raw, [
      "housing",
      "housingProvided"
    ], "Not informed"),

    email: first(raw, [
      "employerEmail",
      "email"
    ]),

    description: first(raw, [
      "jobDescription",
      "description"
    ]),

    source,
    sourceUrl: first(raw, [
      "jobUrl",
      "url",
      "detailUrl"
    ])
  };
}

async function readFeed(feed) {
  const response = await fetch(feed.url, {
    headers: {
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Feed failed: ${feed.name} (${response.status})`);
  }

  const data = await response.json();

  const records = Array.isArray(data)
    ? data
    : data.jobs || data.results || data.data || data.items || [];

  return records.filter(
    record =>
      record &&
      typeof record === "object" &&
      !Array.isArray(record) &&
      record.caseNumber
  );
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

  const store = getStore("vagas-mobile-data", {
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_AUTH_TOKEN
  });

  await store.setJSON("jobs", output);

  return {
    statusCode: errors.length && !output.jobs.length ? 500 : 200,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      saved: true,
      updatedAt: output.updatedAt,
      total: output.total,
      errors: output.errors
    })
  };
};
