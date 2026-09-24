#!/usr/bin/env python3
"""Build data/intel.json from public sources. Run daily by .github/workflows/intel.yml.
Sources: CISA KEV, Have I Been Pwned public breach list, DNS (DMARC/SPF) via Google Public DNS."""
import json, urllib.request, datetime, sys, time
UA = {'User-Agent': 'bigredbox-intel/1.0 (+https://bigredbox.co.uk)'}
KEV = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json'
HIBP = 'https://haveibeenpwned.com/api/v3/breaches'
SUPPLIERS = [
 # id, name, category, domain, KEV vendorProject (or None), extra HIBP domains
 ('microsoft','Microsoft 365','Email, docs, identity','microsoft.com','Microsoft',[]),
 ('google','Google Workspace','Email, docs, identity','google.com','Google',[]),
 ('salesforce','Salesforce','CRM','salesforce.com','Salesforce',[]),
 ('hubspot','HubSpot','CRM and marketing','hubspot.com','HubSpot',[]),
 ('zoom','Zoom','Video meetings','zoom.us','Zoom',[]),
 ('slack','Slack','Team chat','slack.com','Slack',[]),
 ('atlassian','Atlassian (Jira, Confluence, Trello)','Project and knowledge tools','atlassian.com','Atlassian',['trello.com']),
 ('xero','Xero','Accounting','xero.com','Xero',[]),
 ('sage','Sage','Accounting and payroll','sage.com','Sage',[]),
 ('dropbox','Dropbox','File sharing','dropbox.com','Dropbox',[]),
 ('docusign','Docusign','E-signature','docusign.com','DocuSign',[]),
 ('adobe','Adobe','Documents and creative','adobe.com','Adobe',[]),
 ('canva','Canva','Design','canva.com','Canva',[]),
 ('mailchimp','Mailchimp','Email marketing','mailchimp.com','Mailchimp',[]),
 ('linkedin','LinkedIn','Recruitment and sales','linkedin.com','LinkedIn',[]),
 ('okta','Okta','Identity','okta.com','Okta',[]),
 ('fortinet','Fortinet','Firewall and VPN','fortinet.com','Fortinet',[]),
 ('cisco','Cisco','Network and VPN','cisco.com','Cisco',[]),
 ('ivanti','Ivanti','VPN and device management','ivanti.com','Ivanti',[]),
 ('citrix','Citrix','Remote access','citrix.com','Citrix',[]),
 ('sonicwall','SonicWall','Firewall and VPN','sonicwall.com','SonicWall',[]),
 ('connectwise','ConnectWise','MSP remote tools','connectwise.com','ConnectWise',[]),
 ('kaseya','Kaseya','MSP remote tools','kaseya.com','Kaseya',[]),
 ('solarwinds','SolarWinds','IT monitoring','solarwinds.com','SolarWinds',[]),
 ('veeam','Veeam','Backup','veeam.com','Veeam',[]),
]
def get(url):
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r: return json.load(r)
        except Exception as e:
            err = e; time.sleep(3)
    raise err
def txt(name):
    d = get('https://dns.google/resolve?name=%s&type=TXT' % name)
    return [a['data'].strip('"').replace('" "','') for a in d.get('Answer', []) if a.get('type') == 16]
now = datetime.datetime.now(datetime.timezone.utc)
kev = get(KEV); breaches = get(HIBP)
since = (now - datetime.timedelta(days=365)).date().isoformat()
five = (now - datetime.timedelta(days=5*365)).date().isoformat()
out = []
for sid, name, cat, dom, kv, extra in SUPPLIERS:
    vs = [v for v in kev['vulnerabilities'] if kv and v['vendorProject'].lower() == kv.lower()]
    recent = sorted([v for v in vs if v['dateAdded'] >= since], key=lambda v: v['dateAdded'], reverse=True)
    doms = [dom] + extra
    br = sorted([b for b in breaches if (b.get('Domain') or '').lower() in doms], key=lambda b: b['BreachDate'], reverse=True)
    dmarc = [t for t in txt('_dmarc.' + dom) if t.lower().startswith('v=dmarc1')]
    spf = [t for t in txt(dom) if t.lower().startswith('v=spf1')]
    pol = None
    if dmarc:
        for part in dmarc[0].split(';'):
            k, _, v = part.strip().partition('=')
            if k.lower() == 'p': pol = v.strip().lower()
    out.append({
        'id': sid, 'name': name, 'category': cat, 'domain': dom,
        'kev': {'vendor': kv, 'total': len(vs), 'last12m': len(recent),
                'ransomware12m': sum(1 for v in recent if v.get('knownRansomwareCampaignUse') == 'Known'),
                'recent': [{'cve': v['cveID'], 'name': v['vulnerabilityName'], 'product': v['product'], 'added': v['dateAdded'],
                            'ransomware': v.get('knownRansomwareCampaignUse') == 'Known'} for v in recent[:5]]},
        'breaches': [{'name': b['Name'], 'title': b['Title'], 'date': b['BreachDate'], 'accounts': b['PwnCount'],
                      'classes': b['DataClasses'][:6], 'recent': b['BreachDate'] >= five} for b in br],
        'email': {'dmarc': dmarc[0] if dmarc else None, 'policy': pol, 'spf': spf[0] if spf else None},
    })
json.dump({'generated': now.strftime('%Y-%m-%dT%H:%M:%SZ'), 'kevCatalog': kev.get('catalogVersion'), 'kevCount': kev.get('count'),
           'hibpCount': len(breaches), 'windowStart': since,
           'sources': {'kev': 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', 'hibp': 'https://haveibeenpwned.com/PwnedWebsites', 'dns': 'https://dns.google'},
           'suppliers': out}, open(sys.argv[1] if len(sys.argv) > 1 else 'data/intel.json', 'w'), indent=1)
print('ok', len(out))
