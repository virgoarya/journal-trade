const https = require('https');

const codes = ['067651', '088691', '099741'];
const symbols = {'067651': 'CL=F', '088691': 'GC=F', '099741': 'EUR/USD'};

https.get(`https://publicreporting.cftc.gov/resource/6dca-aqww.json?$where=cftc_contract_market_code in ('${codes.join("','")}')&$limit=3&$order=report_date_as_yyyy_mm_dd DESC`, (resp) => {
  let data = '';
  resp.on('data', (chunk) => data += chunk);
  resp.on('end', () => {
    try {
      const records = JSON.parse(data);
      records.forEach(r => {
         console.log(r.contract_market_name, r.cftc_contract_market_code, r.report_date_as_yyyy_mm_dd);
      });
    } catch(e) { console.error(e) }
  });
});
