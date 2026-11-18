'use strict';
/**
 * Calculate an age band from an ISO date without retaining the date itself.
 * Self-declared dates are not documentary proof of age.
 */
function birthBand(iso, now=new Date()) {
  if (typeof iso!=='string'||!/^(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(iso)) return null;
  const [year,month,day]=iso.split('-').map(Number);
  const birth=new Date(Date.UTC(year,month-1,day));
  if(birth.getUTCFullYear()!==year||birth.getUTCMonth()!==month-1||birth.getUTCDate()!==day||birth.getTime()>now.getTime())return null;
  let age=now.getUTCFullYear()-year;
  if((now.getUTCMonth()+1)<month||((now.getUTCMonth()+1)===month&&now.getUTCDate()<day))age--;
  if(age<0||age>125)return null;
  return {age,band:age<16?'under16':age<18?'teen':'adult'};
}
module.exports={birthBand};
