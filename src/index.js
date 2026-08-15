const FEED_790 =
  "https://seasonaljobs.dol.gov/api/feeds/790";

const FEED_9142B =
  "https://seasonaljobs.dol.gov/api/feeds/9142B";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/jobs") {
      return carregarVagas();
    }

    return env.ASSETS.fetch(request);
  }
};

async function carregarVagas() {
  try {
    const respostas = await Promise.all([
      fetch(FEED_790),
      fetch(FEED_9142B)
    ]);

    const dados = [];

    for (const resposta of respostas) {
      if (!resposta.ok) {
        continue;
      }

      const json = await resposta.json();

      if (Array.isArray(json)) {
        dados.push(...json);
      } else if (Array.isArray(json.jobs)) {
        dados.push(...json.jobs);
      } else if (Array.isArray(json.data)) {
        dados.push(...json.data);
      }
    }

    const jobs = dados.map((item, index) =>
      converterVaga(item, index)
    );

    return jsonResponse({
      updatedAt: new Date().toISOString(),
      jobs
    });

  } catch (error) {
    return jsonResponse(
      {
        error: "Não foi possível carregar as vagas",
        jobs: []
      },
      502
    );
  }
}

function converterVaga(item, index) {
  const salaryMin = Number(
    item.wage_rate_from ??
    item.min_wage ??
    item.salary_min ??
    0
  );

  const salaryMax = Number(
    item.wage_rate_to ??
    item.max_wage ??
    item.salary_max ??
    salaryMin
  );

  const title =
    item.job_title ??
    item.title ??
    item.occupation_title ??
    "Vaga sazonal";

  const company =
    item.employer_name ??
    item.employer ??
    item.company ??
    "Empregador não informado";

  const city =
    item.worksite_city ??
    item.city ??
    "Local não informado";

  const state =
    item.worksite_state ??
    item.state ??
    "";

  return {
    id: String(
      item.case_number ??
      item.job_order_number ??
      item.id ??
      index + 1
    ),

    title,
    company,
    city,
    state,

    type: detectarTipo(item),

    salaryMin,
    salaryMax,

    posted:
      item.date_posted ??
      item.posted_date ??
      "",

    start:
      item.employment_start_date ??
      item.start_date ??
      "",

    end:
      item.employment_end_date ??
      item.end_date ??
      "",

    hours:
      item.hours_per_week ??
      item.hours ??
      "Não informado",

    workers:
      item.workers_needed ??
      item.number_of_workers ??
      "Não informado",

    experience:
      item.experience_required ??
      "Não informado",

    housing:
      item.housing ??
      item.housing_provided ??
      "Não informado",

    transport:
      item.transportation ??
      "Não informado",

    meals:
      item.meals ??
      "Não informado",

    tools:
      item.tools ??
      "Não informado",

    email:
      item.contact_email ??
      item.email ??
      "",

    description:
      item.job_description ??
      item.description ??
      "Descrição não informada"
  };
}

function detectarTipo(item) {
  const texto = JSON.stringify(item).toUpperCase();

  if (texto.includes("9142B") || texto.includes("H-2B")) {
    return "H-2B";
  }

  return "H-2A";
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=900"
    }
  });
}
