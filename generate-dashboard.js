const fs = require("fs");

const token = process.env.METRICS_TOKEN;
const username = "gsumithub";

async function fetchData() {
  const query = `
    query {
      user(login: "${username}") {
        repositories(privacy: PUBLIC) {
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
        repositories(first: 100, orderBy: {field: STARGAZERS, direction: DESC}) {
          nodes {
            languages(first: 1, orderBy: {field: SIZE, direction: DESC}) {
              nodes {
                name
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  const json = await response.json();
  return json.data.user;
}

function calculateStreak(weeks) {
  const days = weeks.flatMap(w => w.contributionDays);
  let streak = 0;

  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].contributionCount > 0) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

function generateSVG(data) {
  const totalContributions =
    data.contributionsCollection.contributionCalendar.totalContributions;

  const weeks =
    data.contributionsCollection.contributionCalendar.weeks;

  const streak = calculateStreak(weeks);
  const repoCount = data.repositories.totalCount;

  const topLanguage =
    data.repositories.nodes
      .map(repo => repo.languages.nodes[0]?.name)
      .filter(Boolean)[0] || "N/A";

  return `
  <svg width="900" height="350" xmlns="http://www.w3.org/2000/svg">
    <style>
      .card {
        fill: rgba(20,20,20,0.85);
        stroke: rgba(255,255,255,0.1);
        stroke-width: 1;
        rx: 25;
      }
      .title { font: bold 28px sans-serif; fill: white; }
      .big { font: bold 40px sans-serif; fill: #00ffcc; }
      .label { font: 16px sans-serif; fill: #999; }
    </style>

    <rect x="20" y="20" width="860" height="310" class="card" />

    <text x="60" y="80" class="title">GitHub Analytics</text>

    <text x="60" y="140" class="big">${streak}</text>
    <text x="60" y="170" class="label">Current Commit Streak</text>

    <text x="300" y="140" class="big">${totalContributions}</text>
    <text x="300" y="170" class="label">Contributions This Year</text>

    <text x="580" y="140" class="big">${repoCount}</text>
    <text x="580" y="170" class="label">Public Repositories</text>

    <text x="60" y="240" class="big">${topLanguage}</text>
    <text x="60" y="270" class="label">Top Language</text>
  </svg>
  `;
}

(async () => {
  const data = await fetchData();
  const svg = generateSVG(data);
  fs.writeFileSync("stats/custom-dashboard.svg", svg);
})();
