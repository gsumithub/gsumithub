const fs = require("fs");

const TOKEN = process.env.METRICS_TOKEN;
const USERNAME = "gsumithub";

if (!TOKEN) {
  console.error("❌ METRICS_TOKEN not found.");
  process.exit(1);
}

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
    console.error("GraphQL Error:", JSON.stringify(json.errors, null, 2));
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
              date
            }
          }
        }
      }
    }
  }
  `;

  const data = await fetchGraphQL(query);
  const user = data.user;

  const contributions =
    user.contributionsCollection.contributionCalendar.totalContributions;

  const followers = user.followers.totalCount;
  const repos = user.repositories.totalCount;

  const totalStars = user.repositories.nodes.reduce(
    (acc, repo) => acc + repo.stargazerCount,
    0
  );

  const days = user.contributionsCollection.contributionCalendar.weeks
    .flatMap((w) => w.contributionDays);

  // -------- STREAK CALCULATION --------
  let streak = 0;
  const reversedDays = [...days].reverse();
  for (let day of reversedDays) {
    if (day.contributionCount > 0) streak++;
    else break;
  }

  // -------- LANGUAGE CALCULATION --------
  const languageTotals = {};

  user.repositories.nodes.forEach((repo) => {
    repo.languages.edges.forEach((lang) => {
      const name = lang.node.name;
      const size = lang.size;

      if (!languageTotals[name]) {
        languageTotals[name] = {
          size: 0,
          color: lang.node.color || "#94a3b8",
        };
      }

      languageTotals[name].size += size;
    });
  });

  const totalLangSize = Object.values(languageTotals).reduce(
    (acc, lang) => acc + lang.size,
    0
  );

  const languages = Object.entries(languageTotals)
    .map(([name, data]) => ({
      name,
      percent: (data.size / totalLangSize) * 100,
      color: data.color,
    }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 3);

  // -------- LAST 30 DAYS HEAT STRIP --------
  const last30Days = reversedDays.slice(0, 30).reverse();
  const maxCount = Math.max(...last30Days.map(d => d.contributionCount));

  const heatData = last30Days.map(d => {
    if (maxCount === 0) return 0;
    return Math.min(
      4,
      Math.ceil((d.contributionCount / maxCount) * 4)
    );
  });

  return {
    streak,
    contributions,
    repos,
    totalStars,
    followers,
    languages,
    heatData,
  };
}

async function generateSVG() {
  const data = await getData();

  const barTotalWidth = 420;
  let currentX = 390;
  let languageBars = "";

  data.languages.forEach((lang) => {
    const width = (lang.percent / 100) * barTotalWidth;

    languageBars += `
      <rect x="${currentX}" y="190" width="${width}" height="10" rx="5"
        fill="${lang.color}" />
    `;

    currentX += width;
  });

  // -------- HEAT STRIP --------
  let heatBlocks = "";
  const startX = 60;
  const y = 220;
  const size = 10;
  const gap = 6;

  const heatColors = [
    "#1e293b",
    "#334155",
    "#475569",
    "#64748b",
    "#38bdf8"
  ];

  data.heatData.forEach((level, i) => {
    heatBlocks += `
      <rect
        x="${startX + i * (size + gap)}"
        y="${y}"
        width="${size}"
        height="${size}"
        rx="4"
        fill="${heatColors[level]}"
      />
    `;
  });

  const svg = `
<svg width="900" height="260" viewBox="0 0 900 260" xmlns="http://www.w3.org/2000/svg">

  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>

  <rect width="900" height="260" rx="20" fill="url(#bg)" stroke="#334155" stroke-width="1"/>

  <!-- Username -->
  <text x="60" y="45" fill="#94a3b8" font-size="18" font-family="Arial">
    ${USERNAME}
  </text>

  <!-- Left: Streak -->
  <text x="60" y="130" fill="#38bdf8" font-size="64" font-weight="bold" font-family="Arial">
    ${data.streak}
  </text>

  <text x="60" y="165" fill="#e2e8f0" font-size="20" font-family="Arial">
    Day Commit Streak
  </text>

  <!-- Divider -->
  <line x1="350" y1="40" x2="350" y2="200" stroke="#334155" />

  <!-- Right Stats -->
  <text x="390" y="85" fill="#cbd5e1" font-size="16" font-family="Arial">
    ${data.contributions} Contributions This Year
  </text>

  <text x="390" y="110" fill="#cbd5e1" font-size="16" font-family="Arial">
    ${data.repos} Public Repositories
  </text>

  <text x="390" y="135" fill="#cbd5e1" font-size="16" font-family="Arial">
    ${data.totalStars} Total Stars
  </text>

  <text x="390" y="160" fill="#cbd5e1" font-size="16" font-family="Arial">
    ${data.followers} Followers
  </text>

  <!-- Language Bar -->
  ${languageBars}

  <!-- Heat Strip -->
  ${heatBlocks}

</svg>
`;

  fs.mkdirSync("stats", { recursive: true });
  fs.writeFileSync("stats/custom-dashboard.svg", svg);

  console.log("✅ Recruiter-focused dashboard generated.");
}

generateSVG();
