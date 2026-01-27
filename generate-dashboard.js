const fetch = require("node-fetch");
const fs = require("fs");

const username = "gsumithub";
const token = process.env.METRICS_TOKEN;

if (!token) {
  console.error("Missing METRICS_TOKEN");
  process.exit(1);
}

async function getData() {
  const query = `
    query($login: String!) {
      user(login: $login) {

        followers {
          totalCount
        }

        publicRepos: repositories(privacy: PUBLIC) {
          totalCount
        }

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

        languageRepos: repositories(
          first: 50
          privacy: PUBLIC
          orderBy: {field: PUSHED_AT, direction: DESC}
        ) {
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

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query,
      variables: { login: username },
    }),
  });

  const json = await res.json();

  if (json.errors) {
    console.error("GraphQL Error:", json.errors);
    process.exit(1);
  }

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

function calculateLanguages(repos) {
  const totals = {};

  repos.forEach(repo => {
    repo.languages.edges.forEach(edge => {
      if (!totals[edge.node.name]) {
        totals[edge.node.name] = 0;
      }
      totals[edge.node.name] += edge.size;
    });
  });

  const sorted = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const totalSize = sorted.reduce((acc, curr) => acc + curr[1], 0);

  return sorted.map(([name, size]) => ({
    name,
    percent: ((size / totalSize) * 100).toFixed(1)
  }));
}

function generateSVG(data) {
  const totalContributions =
    data.contributionsCollection.contributionCalendar.totalContributions;

  const weeks =
    data.contributionsCollection.contributionCalendar.weeks;

  const streak = calculateStreak(weeks);

  const languages = calculateLanguages(data.languageRepos.nodes);

  const languageBars = languages.map((lang, i) => {
    const colors = ["#ff5722", "#7c4dff", "#ffd54f"];
    const xOffset = languages.slice(0, i)
      .reduce((acc, l) => acc + (l.percent / 100) * 500, 0);

    const barWidth = (lang.percent / 100) * 500;

    return `
      <rect x="${150 + xOffset}"
            y="200"
            width="${barWidth}"
            height="12"
            rx="6"
            fill="${colors[i] || "#4fc3f7"}" />
      <text x="${150 + xOffset}"
            y="230"
            fill="#cfd8dc"
            font-size="12">
        ${lang.name} ${lang.percent}%
      </text>
    `;
  }).join("");

  return `
<svg width="800" height="260" xmlns="http://www.w3.org/2000/svg">

  <defs>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>

  <rect width="800" height="260" rx="25"
        fill="url(#glass)" stroke="#334155" stroke-width="1"/>

  <text x="40" y="40" fill="#94a3b8" font-size="16">
    gsumithub
  </text>

  <text x="40" y="100" fill="#38bdf8" font-size="64" font-weight="bold">
    ${streak}
  </text>

  <text x="40" y="130" fill="#cbd5e1" font-size="18">
    Day Commit Streak
  </text>

  <text x="400" y="70" fill="#e2e8f0" font-size="16">
    ${totalContributions} Contributions This Year
  </text>

  <text x="400" y="95" fill="#e2e8f0" font-size="16">
    ${data.publicRepos.totalCount} Public Repositories
  </text>

  <text x="400" y="120" fill="#e2e8f0" font-size="16">
    ${data.followers.totalCount} Followers
  </text>

  ${languageBars}

</svg>
`;
}

(async () => {
  const data = await getData();
  const svg = generateSVG(data);
  fs.writeFileSync("stats/custom-dashboard.svg", svg);
})();
