'use strict';
// Keep saved progress compatible when presentation fields are consolidated.
window.FCGCAnswers={normalize(answers){
 const data={...answers};
 const text=value=>typeof value==='string'?value.trim():'';
 const area=text(data.phone_area_code),phone=text(data.phone_number);
 if(area){
  const digits=phone.replace(/\D/g,''),areaDigits=area.replace(/\D/g,'');
  data.phone_number=areaDigits&&digits.length>=10&&digits.startsWith(areaDigits)?phone:[area,phone].filter(Boolean).join(' ');
 }
 if(typeof data.birth_date!=='string'){
  const day=text(data.birth_day),month=text(data.birth_month),year=text(data.birth_year);
  const part=(value,missing)=>value?(/^\d+$/.test(value)?value.padStart(2,'0'):value):missing;
  data.birth_date=day||month||year?`${part(month,'__')}/${part(day,'__')}/${year||'____'}`:'';
 }
 delete data.phone_area_code;
 delete data.birth_day;
 delete data.birth_month;
 delete data.birth_year;
 return data;
}};
