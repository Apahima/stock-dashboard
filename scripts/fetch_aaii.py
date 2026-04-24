"""
Fetches AAII weekly sentiment survey data and saves it to public/aaii.json.
Run via GitHub Actions every Thursday after AAII publishes (~noon ET).
"""
import json
import io
import sys
from datetime import datetime
import requests
import openpyxl

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://www.aaii.com/',
}

def to_pct(v):
    if v is None:
        return 0.0
    v = float(v)
    return round(v * 100, 1) if abs(v) <= 1.0 else round(v, 1)

def fetch():
    r = requests.get(
        'https://www.aaii.com/sentimentsurvey/sent_results',
        headers=HEADERS,
        timeout=30,
        allow_redirects=True,
    )
    r.raise_for_status()

    wb = openpyxl.load_workbook(io.BytesIO(r.content), data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))

    # Locate header row containing Bullish / Neutral / Bearish columns
    header_idx = None
    for i, row in enumerate(rows):
        labels = [str(c or '').lower() for c in row]
        if 'bullish' in labels and 'bearish' in labels:
            header_idx = i
            break

    if header_idx is None:
        raise ValueError('Could not find header row in AAII spreadsheet')

    headers = [str(c or '').lower() for c in rows[header_idx]]

    def col(keyword, exclude='avg'):
        return next(
            i for i, h in enumerate(headers)
            if keyword in h and exclude not in h
        )

    date_col = col('date')
    bull_col = col('bullish')
    neut_col = col('neutral')
    bear_col = col('bearish')

    # Most recent row
    recent = rows[header_idx + 1]
    date_val = recent[date_col]
    date_str = date_val.strftime('%B %d, %Y') if hasattr(date_val, 'strftime') else str(date_val)

    bull = to_pct(recent[bull_col])
    neut = to_pct(recent[neut_col])
    bear = to_pct(recent[bear_col])

    # 8-week historical average
    hist = rows[header_idx + 1: header_idx + 9]
    avg_bull = round(sum(to_pct(r[bull_col]) for r in hist) / len(hist), 1)
    avg_bear = round(sum(to_pct(r[bear_col]) for r in hist) / len(hist), 1)

    return {
        'date': date_str,
        'bullish': bull,
        'neutral': neut,
        'bearish': bear,
        'historicalAvg': {
            'bullish': avg_bull,
            'bearish': avg_bear,
        },
        'updatedAt': datetime.utcnow().isoformat() + 'Z',
    }

if __name__ == '__main__':
    try:
        data = fetch()
        out_path = 'public/aaii.json'
        with open(out_path, 'w') as f:
            json.dump(data, f, indent=2)
        print(f'Saved AAII data to {out_path}:')
        print(json.dumps(data, indent=2))
    except Exception as e:
        print(f'ERROR: {e}', file=sys.stderr)
        sys.exit(1)
