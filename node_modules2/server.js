const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const FEEDS = {
  semafor:  { label: 'Semafor',            url: 'https://www.semafor.com/rss.xml' },
  nytimes:  { label: 'New York Times',      url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml' },
  dowjones: { label: 'DJ World News',      url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml' },
  yahoo:    { label: 'Yahoo Most Viewed',  url: 'https://news.yahoo.com/rss/mostviewed' },
  wsj:      { label: 'WSJ',               url: 'https://www.wsj.com/news/rss-news-and-feeds' },
};

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/sources', (_req, res) => {
  const sources = Object.entries(FEEDS).map(([id, { label }]) => ({ id, label }));
  res.json(sources);
});

app.get('/api/feed/:source', async (req, res) => {
  const feed = FEEDS[req.params.source];
  if (!feed) return res.status(400).json({ error: 'Unknown feed source' });

  try {
    const response = await fetch(feed.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSSNewsReader/1.0; +https://github.com)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      return res.status(502).json({ error: `Feed returned HTTP ${response.status}` });
    }

    const contentType = response.headers.get('content-type') || 'application/xml';
    const text = await response.text();
    res.set('Content-Type', contentType.includes('html') ? 'application/xml' : contentType);
    res.send(text);
  } catch (err) {
    const message = err.name === 'TimeoutError' ? 'Feed request timed out' : err.message;
    res.status(502).json({ error: message });
  }
});

app.listen(PORT, () => console.log(`RSS News Reader running on http://localhost:${PORT}`));
