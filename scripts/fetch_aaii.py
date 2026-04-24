"""
Scrapes AAII weekly sentiment data from the public survey page.
The Excel download requires login, but current-week data is visible publicly.
"""
import json
import re
import sys
from datetime import datetime
import requests
from bs4 import BeautifulSoup

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.aaii.com/',
}

HISTORICAL_AVG = {'bullish': 37.5, 'bearish': 31.0}  # Long-run AAII averages


def pct(s):
    """Parse a percentage string like '38.3' or '38.3%' to float."""
    s = str(s).strip().replace('%', '')
    try:
        return round(float(s), 1)
    except ValueError:
        return None


def fetch():
    r = requests.get(
        'https://www.aaii.com/sentimentsurvey',
        headers=HEADERS,
        timeout=30,
    )
    r.raise_for_status()

    soup = BeautifulSoup(r.content, 'html.parser')
    text = soup.get_text(separator=' ')

    print(f'Page length: {len(text)} chars')

    # ── Strategy 1: find a table row with Bull/Neutral/Bear numbers ──────────
    bull = neut = bear = None
    date_str = None

    # Try to find structured table data
    for table in soup.find_all('table'):
        rows = table.find_all('tr')
        for row in rows:
            cells = [td.get_text(strip=True) for td in row.find_all(['td', 'th'])]
            row_text = ' '.join(cells).lower()
            if 'bullish' in row_text and '%' in row_text:
                nums = re.findall(r'(\d+\.?\d*)%', row.get_text())
                if len(nums) >= 3:
                    bull, neut, bear = pct(nums[0]), pct(nums[1]), pct(nums[2])
                    print(f'Found via table: bull={bull} neut={neut} bear={bear}')
                    break
        if bull is not None:
            break

    # ── Strategy 2: regex scan the full page text ─────────────────────────────
    if bull is None:
        # Look for sequences like: Bullish 38.3% Neutral 32.1% Bearish 29.6%
        m = re.search(
            r'[Bb]ullish[^\d]*(\d+\.?\d+)%[^Nn]*[Nn]eutral[^\d]*(\d+\.?\d+)%[^Bb]*[Bb]earish[^\d]*(\d+\.?\d+)%',
            text,
        )
        if m:
            bull, neut, bear = pct(m.group(1)), pct(m.group(2)), pct(m.group(3))
            print(f'Found via regex: bull={bull} neut={neut} bear={bear}')

    # ── Strategy 3: individual keyword search ─────────────────────────────────
    if bull is None:
        def find_pct(keyword):
            m = re.search(rf'{keyword}[^%\d]{{0,30}}(\d+\.?\d+)%', text, re.IGNORECASE)
            return pct(m.group(1)) if m else None

        bull = find_pct('bullish')
        neut = find_pct('neutral')
        bear = find_pct('bearish')
        print(f'Found via individual search: bull={bull} neut={neut} bear={bear}')

    if bull is None or neut is None or bear is None:
        raise ValueError(
            f'Could not extract sentiment data from page. '
            f'Got: bull={bull}, neut={neut}, bear={bear}'
        )

    # ── Date: find "week ending" or similar phrase ────────────────────────────
    date_match = re.search(
        r'[Ww]eek\s+[Ee]nding\s+([\w]+\s+\d+,?\s*\d{4})',
        text,
    )
    if date_match:
        date_str = date_match.group(1).strip()
    else:
        # Fall back to today's date
        date_str = datetime.utcnow().strftime('%B %d, %Y')

    return {
        'date':     date_str,
        'bullish':  bull,
        'neutral':  neut,
        'bearish':  bear,
        'historicalAvg': HISTORICAL_AVG,
        'updatedAt': datetime.utcnow().isoformat() + 'Z',
    }


if __name__ == '__main__':
    try:
        data = fetch()
        out_path = 'public/aaii.json'
        with open(out_path, 'w') as f:
            json.dump(data, f, indent=2)
        print(f'\nSaved to {out_path}:')
        print(json.dumps(data, indent=2))
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f'ERROR: {e}', file=sys.stderr)
        sys.exit(1)
