const fs = require("fs");

const username = "gsumithub";
const token = process.env.METRICS_TOKEN;

if (!token) {
  console.error("Missing METRICS_TOKEN");
  process.exit(1);
}

async function fetchGraphQL(query, variables = {}) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();

  if (json.errors) {
    console.error("GraphQL Error:", JSON.stringify(json.errors, null, 2));
    process.exit(1);
  }

  return json.data;
}

async function getData() {
  const query = `
    query($login: String!) {
      user(login: $login) {
        followers { totalCount }
        repositories(privacy: PUBLIC) { totalCount }
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
        repositories(first: 50, privacy: PUBLIC, orderBy: {field: PUSHED_AT, direction: DESC}) {
          nodes {
            languages(first: 5, orderBy: {field: SIZE, direction: DESC}) {
              edges {
                size
                node {
                  name
                }
              }
            }
          }
        }
      }
    }
  `;

  return fetchGraphQL(query, { login: username });
}

function calculateStreak(weeks) {
  const days = weeks.flatMap(w => w.contributionDays);

  // Sort newest first
  days.sort((a, b) => new Date(b.date) - new Date(a.date));

  let streak = 0;

  for (let day of days) {
    if (day.contributionCount > 0) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

function calculateLanguages(repos) {
  const totals = {};

  repos.forEach(repo => {
    repo.languages.edges.forEach(edge => {
      if (!totals[edge.node.name]) totals[edge.node.name] = 0;
      totals[edge.node.name] += edge.size;
    });
  });

  const sorted = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const totalSize = sorted.reduce((sum, l) => sum + l[1], 0);

  return sorted.map(([name, size]) => ({
    name,
    percent: ((size / totalSize) * 100).toFixed(1),
  }));
}

function generateSVG(data) {
  const user = data.user;

  const streak = calculateStreak(
    user.contributionsCollection.contributionCalendar.weeks
  );

  const contributions =
    user.contributionsCollection.contributionCalendar.totalContributions;

  const repos = user.repositories.totalCount;
  const followers = user.followers.totalCount;

  const languages = calculateLanguages(user.repositories.nodes);

  const languageBars = languages
    .map(
      (lang, i) => `
        <rect x="${50 + i * 200}" y="170" width="${lang.percent * 2}" height="12" rx="6" fill="${
        ["#ff6b6b", "#845ef7", "#ffd43b"][i]
      }"/>
        <text x="${50 + i * 200}" y="200" fill="#cbd5e1" font-size="14">
          ${lang.name} ${lang.percent}%
        </text>
      `
    )
    .join("");

  return `
<svg width="900" height="250" xmlns="http://www.w3.org/2000/svg">

  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>

  <rect width="900" height="250" rx="25" fill="url(#bg)" />

  <text x="50" y="60" fill="#38bdf8" font-size="50" font-weight="bold">
    🔥 ${streak}
  </text>

  <text x="50" y="95" fill="#94a3b8" font-size="18">
    Day Commit Streak
  </text>

  <text x="300" y="70" fill="#e2e8f0" font-size="18">
    ${contributions} Contributions This Year
  </text>

  <text x="300" y="100" fill="#e2e8f0" font-size="18">
    ${repos} Public Repositories
  </text>

  <text x="300" y="130" fill="#e2e8f0" font-size="18">
    ${followers} Followers
  </text>

  ${languageBars}

</svg>
`;
}

async function main() {
  const data = await getData();

  const svg = generateSVG(data);

  fs.mkdirSync("stats", { recursive: true });
  fs.writeFileSync("stats/custom-dashboard.svg", svg);

  console.log("Dashboard updated successfully.");
}

main();
