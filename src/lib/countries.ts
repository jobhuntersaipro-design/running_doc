/** ISO 3166-1 alpha-2 codes, plus Kosovo (XK). Names come from Intl, so there is no list of names to keep up to date. */
const CODES =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW";

const names = new Intl.DisplayNames("en", { type: "region" });

/** Every country, A to Z by English name. */
export const COUNTRIES = CODES.split(" ")
  .map((code) => ({ code, name: names.of(code) ?? code }))
  .sort((a, b) => a.name.localeCompare(b.name));

/** A country by its code or English name, any case. */
export function findCountry(value: string) {
  const v = value.trim().toLowerCase();
  return COUNTRIES.find((c) => c.code.toLowerCase() === v || c.name.toLowerCase() === v);
}

/** Reads "Kuala Lumpur, Malaysia" from a race saved before country and city were separate fields. */
export function splitLocation(location: string): { city: string; country: string } {
  const at = location.lastIndexOf(",");
  const last = at < 0 ? location : location.slice(at + 1);
  const country = findCountry(last);
  return country ? { city: at < 0 ? "" : location.slice(0, at).trim(), country: country.code } : { city: location.trim(), country: "" };
}
