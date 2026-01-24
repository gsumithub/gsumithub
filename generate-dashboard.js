const fs = require("fs");

const username = "gsumithub";
const token = process.env.METRICS_TOKEN;

if (!token) {
  console.error("❌ METRICS_TOKEN not found in environment.");
  process.exit(1);
}

async function fetchData() {
  const query = `
  {
    user(login: "${username}") {
      followers {
        totalCount
      }

      contributionsCollection {
        contributionCalendar {
          totalContributions
        }
      }

      repositories(first: 100, privacy: PUBLIC) {
        totalCount
        nodes {
          stargazerCount
          primaryLanguage {
            name
          }
        }
      }
    }
  }
  `;

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query })
  });

  const json = await res.json();

  if (json.errors) {
    console.error("❌ GraphQL Error:", JSON.stringify(json.errors, null, 2));
    process.exit(1);
  }

  return json.data.user;
}

function generateSVG(data) {
  const followers = data.followers.totalCount;
  const contributions = data.contributionsCollection.contributionCalendar.totalContributions;
  const repoCount = data.repositories.totalCount;

  const repos = data.repositories.nodes;

  const totalStars = repos.reduce(
    (acc, repo) => acc + repo.stargazerCount,
    0
  );

  const languageMap = {};
  repos.forEach(repo => {
    if (repo.primaryLanguage?.name) {
      languageMap[repo.primaryLanguage.name] =
        (languageMap[repo.primaryLanguage.name] || 0) + 1;
    }
  });

  const topLanguage =
    Object.entries(languageMap).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

  // Simple streak estimate (since real streak needs daily calendar parsing)
  const streakEstimate = Math.floor(contributions / 12);

  return `
  <svg width="800" height="300" viewBox="0 0 800 300" xmlns="http://www.w3.org/2000/svg">

    <defs>
      <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1e293b" />
        <stop offset="100%" stop-color="#0f172a" />
      </linearGradient>
    </defs>

    <rect width="800" height="300" rx="25" fill="url(#glass)" stroke="#334155" stroke-width="2"/>

    <!-- Name -->
    <text x="50" y="60" fill="#ffffff" font-size="28" font-family="Arial" font-weight="bold">
      ${username}
    </text>

    <!-- Big Streak -->
    <text x="50" y="130" fill="#38bdf8" font-size="52" font-family="Arial" font-weight="bold">
      ${streakEstimate} Day Streak
    </text>

    <!-- Stats -->
    <text x="50" y="180" fill="#94a3b8" font-size="18" font-family="Arial">
      Contributions This Year: ${contributions}
    </text>

    <text x="50" y="210" fill="#94a3b8" font-size="18" font-family="Arial">
      Public Repositories: ${repoCount}
    </text>

    <text x="50" y="240" fill="#94a3b8" font-size="18" font-family="Arial">
      Total Stars: ${totalStars}
    </text>

    <text x="400" y="180" fill="#94a3b8" font-size="18" font-family="Arial">
      Followers: ${followers}
    </text>

    <text x="400" y="210" fill="#94a3b8" font-size="18" font-family="Arial">
      Top Language: ${topLanguage}
    </text>

  </svg>
  `;
}

async function main() {
  const data = await fetchData();
  const svg = generateSVG(data);

  fs.mkdirSync("stats", { recursive: true });
  fs.writeFileSync("stats/custom-dashboard.svg", svg);

  console.log("✅ SVG generated successfully.");
}

main();
