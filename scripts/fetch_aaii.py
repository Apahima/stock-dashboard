"""
Scrapes AAII weekly sentiment data from the public survey page.
Looks for date/percentage rows like "4/22/2026  46.0%  19.5%  34.4%"
which appear in the data table, not in the historical-average section.
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
}

# Official AAII long-run averages (shown on their site)
HISTORICAL_AVG = {'bullish': 37.5, 'neutral': 31.5, 'bearish': 31.0}


def pct(s):
    return round(float(str(s).strip().replace('%', '')), 1)


def fetch():
    r = requests.get('https://www.aaii.com/sentimentsurvey', headers=HEADERS, timeout=30)
    r.raise_for_status()

    soup = BeautifulSoup(r.content, 'html.parser')
    text = soup.get_text(separator=' ')

    print(f'Page length: {len(text)} chars')

    # ── Strategy 1: find rows with a MM/DD/YYYY date followed by 3 percentages ─
    # This matches rows from the weekly data table, not the historical average text.
    # Example: "4/22/2026  46.0%  19.5%  34.4%"
    date_row_pattern = re.compile(
        r'(\d{1,2}/\d{1,2}/\d{4})'           # date like 4/22/2026
        r'[^\d%]{0,20}'                        # small gap (spaces, newlines)
        r'(\d+\.?\d*)%'                        # bullish %
        r'[^\d%]{0,20}'
        r'(\d+\.?\d*)%'                        # neutral %
        r'[^\d%]{0,20}'
        r'(\d+\.?\d*)%'                        # bearish %
    )
    matches = date_row_pattern.findall(text)

    if matches:
        # First match = most recent week
        date_raw, bull, neut, bear = matches[0]
        print(f'Found via date-row pattern: {date_raw} | bull={bull} neut={neut} bear={bear}')

        # Format date: 4/22/2026 → April 22, 2026
        try:
            date_str = datetime.strptime(date_raw, '%m/%d/%Y').strftime('%B %d, %Y')
        except ValueError:
            date_str = date_raw

        return {
            'date':          date_str,
            'bullish':       pct(bull),
            'neutral':       pct(neut),
            'bearish':       pct(bear),
            'historicalAvg': HISTORICAL_AVG,
            'updatedAt':     datetime.utcnow().isoformat() + 'Z',
        }

    # ── Strategy 2: parse tables directly ────────────────────────────────────
    print('Date-row pattern not found, trying table parse…')
    for table in soup.find_all('table'):
        headers_row = table.find('tr')
        if not headers_row:
            continue
        header_text = headers_row.get_text().lower()
        if 'bullish' not in header_text and 'bearish' not in header_text:
            continue

        # Found the right table — grab first data row
        data_rows = table.find_all('tr')[1:]
        for row in data_rows:
            cells = [td.get_text(strip=True) for td in row.find_all('td')]
            nums  = [c.replace('%', '') for c in cells if re.match(r'^\d+\.?\d*%?$', c)]
            dates = [c for c in cells if re.match(r'\d{1,2}/\d{1,2}/\d{4}', c)]
            if len(nums) >= 3 and dates:
                bull, neut, bear = nums[0], nums[1], nums[2]
                date_str = datetime.strptime(dates[0], '%m/%d/%Y').strftime('%B %d, %Y')
                print(f'Found via table: {date_str} | bull={bull} neut={neut} bear={bear}')
                return {
                    'date':          date_str,
                    'bullish':       pct(bull),
                    'neutral':       pct(neut),
                    'bearish':       pct(bear),
                    'historicalAvg': HISTORICAL_AVG,
                    'updatedAt':     datetime.utcnow().isoformat() + 'Z',
                }

    raise ValueError('Could not extract current-week AAII sentiment data from page.')


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
