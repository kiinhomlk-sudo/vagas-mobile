import { unzipSync, strFromU8 } from
  "https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js";

const FEED_BASE =
  "https://api.seasonaljobs.dol.gov/datahub-search/sjCaseData/zip/jo/";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/jobs") {
      return await getJobs();
    }

    return env.ASSETS.fetch(request);
  }
};

async function getJobs() {
  const date = getDate();
  const source = FEED_BASE + date;

  try {
    const response = await fetch(source, {
      headers: {
        "Accept": "application/zip, application/octet-stream",
        "User-Agent": "vagas-mobile-site1"
      }
    });

    if (!response.ok) {
      throw new Error(
        "SeasonalJobs retornou HTTP " + response.status
      );
    }

    const bytes = new Uint8Array(
      await response.arrayBuffer()
    );

    const files = unzipSync(bytes);
    const records = [];
    const fileNames = Object.keys(files);

    for (const fileName of fileNames) {
      const lower = fileName.toLowerCase();

      if (
        lower.endsWith(".json") ||
        lower.endsWith(".jsonl")
      ) {
        const text = strFromU8(files[fileName]);
        records.push(...readRecords(text));
      }
    }

    const jobs = records.map((item, index) => ({
      id: String(
        item.case_number ||
        item.caseNumber ||
        item.job_order_number ||
        item.jobOrderNumber ||
        item.id ||
        index + 1
      ),

      title: String(
        item.job_title ||
        item.jobTitle ||
        item.title ||
        "Vaga sazonal"
      ),

      company: String(
        item.employer_name ||
        item.employerName ||
        item.employer ||
        item.company ||
        "Empregador não informado"
      ),

      city: String(
        item.worksite_city ||
        item.worksiteCity ||
        item.city ||
        "Local não informado"
      ),

      state: String(
        item.worksite_state ||
        item.worksiteState ||
        item.state ||
        ""
      ),

      type: "H-2A",

      salaryMin: Number(
        item.wage_rate_from ||
        item.wageRateFrom ||
        item.wage_from ||
        item.wageFrom ||
        0
      ),

      salaryMax: Number(
        item.wage_rate_to ||
        item.wageRateTo ||
        item.wage_to ||
        item.wageTo ||
        item.wage_rate_from ||
        0
      ),

      posted: String(
        item.date_posted ||
        item.datePosted ||
        item.posted_date ||
        ""
      ),

      start: String(
        item.employment_start_date ||
        item.employmentStartDate ||
        item.start_date ||
        ""
      ),

      end: String(
        item.employment_end_date ||
        item.employmentEndDate ||
        item.end_date ||
        ""
      ),

      hours: String(
        item.hours_per_week ||
        item.hoursPerWeek ||
        item.hours ||
        "Não informado"
      ),

      workers: String(
        item.workers_needed ||
        item.workersNeeded ||
        item.number_of_workers ||
        "Não informado"
      ),

      experience: String(
        item.experience_required ||
        item.experienceRequired ||
        item.experience ||
        "Não informado"
      ),

      housing: String(
        item.housing ||
        item.housing_provided ||
        item.housingProvided ||
        "Não informado"
      ),

      transport: String(
        item.transportation ||
        item.transport ||
        item.transportation_provided ||
        "Não informado"
      ),

      meals: String(
        item.meals ||
        item.meals_provided ||
        "Não informado"
      ),

      tools: String(
        item.tools ||
        item.tools_provided ||
        "Não informado"
      ),

      email: String(
        item.contact_email ||
        item.contactEmail ||
        item.email ||
        ""
      ),

      description: String(
        item.job_description ||
        item.jobDescription ||
        item.description ||
        item.job_duties ||
        "Descrição não informada"
      ),

      originalUrl: String(
        item.url ||
        item.job_url ||
        item.jobUrl ||
        ""
      )
    }));

    return json({
      updatedAt: new Date().toISOString(),
      source,
      files: fileNames,
      sourceRecords: records.length,
      total: jobs.length,
      jobs
    });

  } catch (error) {
    return json({
      error: "Não foi possível carregar as vagas do SeasonalJobs.",
      details: error.message,
      source,
      jobs: []
    }, 502);
  }
}

function getDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function readRecords(text) {
  const value = text.trim();

  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (parsed && typeof parsed === "object") {
      for (const item of Object.values(parsed)) {
        if (Array.isArray(item)) {
          return item;
        }
      }

      return [parsed];
    }
  } catch {
    return value
      .split(/\r?\n/)
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

function json(data, status = 200) {
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
