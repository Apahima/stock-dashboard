"""
Fetches AAII weekly sentiment survey data and saves it to public/aaii.json.
Run via GitHub Actions every Thursday after AAII publishes (~noon ET).
AAII serves an old .xls file, so we use xlrd to parse it.
"""
import json
import io
import sys
from datetime import datetime
import requests
import xlrd

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://www.aaii.com/',
    'Accept': 'application/vnd.ms-excel,application/octet-stream,*/*',
}

def to_pct(v):
    if v is None or v == '':
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

    content = r.content
    print(f"Response size: {len(content)} bytes, Content-Type: {r.headers.get('Content-Type','?')}")

    # Detect format
    if content[:2] == b'PK':
        # xlsx (zip-based) — unlikely but handle it
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
        ws = wb.active
        rows = [tuple(c.value for c in row) for row in ws.iter_rows()]
    else:
        # Assume old .xls format
        wb = xlrd.open_workbook(file_contents=content)
        ws = wb.sheet_by_index(0)
        rows = [ws.row_values(i) for i in range(ws.nrows)]

    # Find header row containing Bullish / Bearish columns
    header_idx = None
    for i, row in enumerate(rows):
        labels = [str(c or '').strip().lower() for c in row]
        if any('bullish' in l for l in labels) and any('bearish' in l for l in labels):
            header_idx = i
            break

    if header_idx is None:
        raise ValueError('Could not find header row in AAII spreadsheet')

    headers = [str(c or '').strip().lower() for c in rows[header_idx]]
    print(f"Headers: {headers}")

    def col(keyword, exclude='avg'):
        return next(
            i for i, h in enumerate(headers)
            if keyword in h and exclude not in h
        )

    date_col = col('date')
    bull_col = col('bullish')
    neut_col = col('neutral')
    bear_col = col('bearish')

    # Most recent data row
    recent   = rows[header_idx + 1]
    date_raw = recent[date_col]

    # xlrd returns dates as floats; convert to datetime
    if isinstance(date_raw, float):
        date_tuple = xlrd.xldate_as_tuple(date_raw, wb.datemode)
        date_val   = datetime(*date_tuple[:3])
        date_str   = date_val.strftime('%B %d, %Y')
    elif hasattr(date_raw, 'strftime'):
        date_str = date_raw.strftime('%B %d, %Y')
    else:
        date_str = str(date_raw).strip()

    bull = to_pct(recent[bull_col])
    neut = to_pct(recent[neut_col])
    bear = to_pct(recent[bear_col])

    # 8-week historical average
    hist     = rows[header_idx + 1: header_idx + 9]
    avg_bull = round(sum(to_pct(r[bull_col]) for r in hist) / len(hist), 1)
    avg_bear = round(sum(to_pct(r[bear_col]) for r in hist) / len(hist), 1)

    return {
        'date':     date_str,
        'bullish':  bull,
        'neutral':  neut,
        'bearish':  bear,
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
        import traceback
        traceback.print_exc()
        print(f'ERROR: {e}', file=sys.stderr)
        sys.exit(1)
