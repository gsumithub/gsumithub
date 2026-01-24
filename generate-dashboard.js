const fs = require("fs");

const TOKEN = process.env.METRICS_TOKEN;
const USERNAME = "gsumithub";

async function fetchGraphQL(query) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  const json = await res.json();

  if (json.errors) {
    console.error("GraphQL Error:", json.errors);
    process.exit(1);
  }

  return json.data;
}

async function getData() {
  const query = `
  {
    user(login: "${USERNAME}") {
      followers { totalCount }
      repositories(first: 100, privacy: PUBLIC) {
        totalCount
        nodes {
          stargazerCount
          languages(first: 5, orderBy: {field: SIZE, direction: DESC}) {
            edges {
              size
              node {
                name
                color
              }
            }
          }
        }
      }
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              contributionCount
            }
          }
        }
      }
    }
  }
  `;

  const data = await fetchGraphQL(query);
  const user = data.user;

  const totalRepos = user.repositories.totalCount;
  const followers = user.followers.totalCount;

  const totalStars = user.repositories.nodes.reduce(
    (acc, repo) => acc + repo.stargazerCount,
    0
  );

  const contributions =
    user.contributionsCollection.contributionCalendar.totalContributions;

  // Calculate streak
  let streak = 0;
  const days = user.contributionsCollection.contributionCalendar.weeks
    .flatMap((w) => w.contributionDays)
    .reverse();

  for (let day of days) {
    if (day.contributionCount > 0) streak++;
    else break;
  }

  // Collect language sizes
  const languageTotals = {};

  user.repositories.nodes.forEach((repo) => {
    repo.languages.edges.forEach((lang) => {
      const name = lang.node.name;
      const size = lang.size;

      if (!languageTotals[name]) {
        languageTotals[name] = {
          size: 0,
          color: lang.node.color || "#888888",
        };
      }

      languageTotals[name].size += size;
    });
  });

  const totalSize = Object.values(languageTotals).reduce(
    (acc, lang) => acc + lang.size,
    0
  );

  const sortedLanguages = Object.entries(languageTotals)
    .map(([name, data]) => ({
      name,
      percent: ((data.size / totalSize) * 100).toFixed(1),
      color: data.color,
    }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 5);

  return {
    totalRepos,
    followers,
    totalStars,
    contributions,
    streak,
    languages: sortedLanguages,
  };
}

async function generateSVG() {
  const data = await getData();

  let currentX = 60;
  let languageBars = "";
  let languageLabels = "";

  data.languages.forEach((lang) => {
    const width = (lang.percent / 100) * 780;

    languageBars += `
      <rect x="${currentX}" y="230" width="${width}" height="16"
        fill="${lang.color}" rx="4"/>
    `;

    languageLabels += `
      <text x="${currentX}" y="270" font-size="14" fill="#cbd5e1">
        ${lang.name} ${lang.percent}%
      </text>
    `;

    currentX += width;
  });

  const svg = `
  <svg width="900" height="320" viewBox="0 0 900 320" xmlns="http://www.w3.org/2000/svg">

    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#1e293b"/>
      </linearGradient>
    </defs>

    <rect width="900" height="320" rx="30" fill="url(#bg)" stroke="#334155"/>

    <text x="60" y="70" font-size="28" fill="#94a3b8">${USERNAME}</text>

    <text x="60" y="130" font-size="56" font-weight="bold" fill="#38bdf8">
      ${data.streak} DAY STREAK
    </text>

    <text x="60" y="180" font-size="16" fill="#64748b">
      Contributions This Year: ${data.contributions}
    </text>

    <text x="400" y="180" font-size="16" fill="#64748b">
      Repositories: ${data.totalRepos}
    </text>

    <text x="650" y="180" font-size="16" fill="#64748b">
      Stars: ${data.totalStars}
    </text>

    <!-- Language Bar -->
    ${languageBars}

    <!-- Language Labels -->
    ${languageLabels}

  </svg>
  `;

  fs.writeFileSync("stats/custom-dashboard.svg", svg);
}

generateSVG();
