const fs = require("fs");

const TOKEN = process.env.METRICS_TOKEN;
const USERNAME = "gsumithub";

async function fetchGitHubData() {
  const query = `
  query {
    user(login: "${USERNAME}") {
      name
      repositories(first: 100, privacy: PUBLIC, ownerAffiliations: OWNER) {
        totalCount
        nodes {
          stargazerCount
          languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
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
      followers {
        totalCount
      }
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              contributionCount
              date
            }
          }
        }
      }
    }
  }`;

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
    console.error(json.errors);
    process.exit(1);
  }

  return json.data.user;
}

function calculateStreak(weeks) {
  const days = weeks.flatMap(w => w.contributionDays);
  let streak = 0;

  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].contributionCount > 0) streak++;
    else break;
  }

  return streak;
}

function buildWeeklySparkline(weeks) {
  const last12Weeks = weeks.slice(-12);

  const weeklyTotals = last12Weeks.map(week =>
    week.contributionDays.reduce((sum, d) => sum + d.contributionCount, 0)
  );

  const max = Math.max(...weeklyTotals, 1);

  return weeklyTotals
    .map(val => {
      const height = Math.round((val / max) * 20);
      return `<rect width="8" height="${height}" x="${weeklyTotals.indexOf(val) * 12}" y="${30 - height}" rx="2" fill="#3b82f6"/>`;
    })
    .join("");
}

function buildLanguageBar(repos) {
  const languageMap = {};
  let totalSize = 0;

  repos.nodes.forEach(repo => {
    repo.languages.edges.forEach(lang => {
      if (!languageMap[lang.node.name]) {
        languageMap[lang.node.name] = {
          size: 0,
          color: lang.node.color,
        };
      }
      languageMap[lang.node.name].size += lang.size;
      totalSize += lang.size;
    });
  });

  const sorted = Object.entries(languageMap)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 4);

  let x = 0;
  return sorted.map(([name, data]) => {
    const percent = (data.size / totalSize) * 100;
    const width = percent * 3;
    const rect = `<rect x="${x}" y="0" width="${width}" height="10" fill="${data.color}" rx="3"/>`;
    x += width;
    return rect;
  }).join("");
}

function generateSVG(data) {
  const streak = calculateStreak(data.contributionsCollection.contributionCalendar.weeks);
  const totalContributions = data.contributionsCollection.contributionCalendar.totalContributions;
  const stars = data.repositories.nodes.reduce((sum, r) => sum + r.stargazerCount, 0);
  const repos = data.repositories.totalCount;
  const followers = data.followers.totalCount;

  const sparkline = buildWeeklySparkline(
    data.contributionsCollection.contributionCalendar.weeks
  );

  const languageBar = buildLanguageBar(data.repositories);

  return `
<svg width="900" height="220" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>

  <rect width="900" height="220" rx="20" fill="url(#bg)" />

  <text x="40" y="50" fill="#94a3b8" font-size="14">${USERNAME}</text>

  <text x="40" y="100" fill="#38bdf8" font-size="48" font-weight="bold">
    ${streak}
  </text>
  <text x="40" y="130" fill="#cbd5e1" font-size="16">
    Day Commit Streak
  </text>

  <text x="320" y="70" fill="#cbd5e1" font-size="14">
    ${totalContributions} Contributions This Year
  </text>
  <text x="320" y="95" fill="#cbd5e1" font-size="14">
    ${repos} Public Repositories
  </text>
  <text x="320" y="120" fill="#cbd5e1" font-size="14">
    ${stars} Total Stars
  </text>
  <text x="320" y="145" fill="#cbd5e1" font-size="14">
    ${followers} Followers
  </text>

  <g transform="translate(40,170)">
    ${sparkline}
  </g>

  <g transform="translate(320,170)">
    ${languageBar}
  </g>

</svg>
`;
}

async function main() {
  const data = await fetchGitHubData();
  const svg = generateSVG(data);

  fs.writeFileSync("stats/custom-dashboard.svg", svg);
}

main();
