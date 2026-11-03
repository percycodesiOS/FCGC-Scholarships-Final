'use strict';
// PDF creation stays on the applicant's device. Settings are read from the live admin configuration.
async function prependFoundationInstructions(doc,config){
 const content=config.instructions||config;
 if(!Array.isArray(content.eligibility)||!content.eligibility.length||!Array.isArray(content.requirements)||!content.requirements.length)throw new Error('The current Foundation instructions could not load. Please refresh this page and try again.');
 const {StandardFonts,rgb}=PDFLib;
 const regular=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 const green=rgb(.13,.26,.22),ink=rgb(.12,.18,.16),muted=rgb(.35,.40,.37),cream=rgb(.97,.96,.92);
 const width=504,lineHeight=14,bodySize=10.5;
 let page,y,pageCount=0;
 const text=value=>String(value??'').replaceAll('{year}',config.year).replace(/\r\n?/g,'\n').replace(/\t/g,' ');
 function wrap(value,available,size=bodySize,face=regular){
  const result=[];
  for(const paragraph of text(value).split('\n')){
   if(!paragraph){result.push('');continue;}
   let line='';
   for(const word of paragraph.split(/\s+/)){
    try{face.encodeText(word);}catch{throw new Error('The Foundation instructions contain a character this PDF cannot print. Please contact the Foundation.');}
    if(face.widthOfTextAtSize((line?line+' ':'')+word,size)<=available){line+=(line?' ':'')+word;continue;}
    if(line){result.push(line);line='';}
    let rest=word;
    while(face.widthOfTextAtSize(rest,size)>available){let end=1;while(end<rest.length&&face.widthOfTextAtSize(rest.slice(0,end+1),size)<=available)end++;result.push(rest.slice(0,end));rest=rest.slice(end);}
    line=rest;
   }
   result.push(line);
  }
  return result;
 }
 function startPage(title){
  page=doc.insertPage(pageCount++,[612,792]);
  page.drawRectangle({x:0,y:682,width:612,height:110,color:green});
  page.drawText('FOX CHAPEL GOLF CLUB',{x:54,y:752,size:15,font:bold,color:rgb(1,1,1)});
  page.drawText('SCHOLARSHIP FOUNDATION, INC.',{x:54,y:731,size:12,font:bold,color:rgb(1,1,1)});
  page.drawText(`${config.year} SCHOLARSHIP PROGRAM`,{x:54,y:706,size:10,font:regular,color:cream});
  page.drawText(title,{x:54,y:650,size:18,font:bold,color:green});
  page.drawLine({start:{x:54,y:58},end:{x:558,y:58},thickness:.5,color:rgb(.75,.78,.74)});
  page.drawText(`Foundation instructions | ${config.year}`,{x:54,y:42,size:8,font:regular,color:muted});
  page.drawText(String(pageCount),{x:550,y:42,size:8,font:regular,color:muted});
  y=626;
 }
 function ensure(height){if(y-height<76)startPage('Application instructions (continued)');}
 function paragraph(value,{indent=0,face=regular,gap=7}={}){
  for(const line of wrap(value,width-indent,bodySize,face)){ensure(lineHeight);if(line)page.drawText(line,{x:54+indent,y,size:bodySize,font:face,color:ink});y-=lineHeight;}
  y-=gap;
 }
 function heading(value){ensure(44);y-=5;page.drawText(value,{x:54,y,size:12,font:bold,color:green});y-=20;}
 function list(items){for(const item of items){ensure(28);page.drawText('\u2022',{x:56,y,size:bodySize,font:regular,color:green});paragraph(item,{indent:15,gap:6});}}
 startPage('Application cover letter & instructions');
 paragraph(`Dear ${config.year} Scholarship Applicant,`,{face:bold});
 paragraph(content.welcome);
 paragraph(`Submission deadline: ${config.deadline}`,{face:bold});
 paragraph('Your completed application and required materials must arrive by the deadline.');
 heading('Eligibility requirements');
 list(content.eligibility);
 heading('Required materials');
 list(content.requirements);
 startPage('Complete, review and send');
 heading('Complete the application');
 paragraph('You can complete the application online, save your progress, calculate totals, and draw or type your signature. The fillable application follows these instructions if you prefer to complete a PDF.');
 paragraph('Complete all six sections. Use your school\'s estimate for one full academic year, list scholarships and grants by name and amount, and explain pending aid or missing documents in the space provided.');
 paragraph('Sign the application. A parent or guardian must also sign if the applicant is under 18. Review your answers, totals, signatures and supporting documents, and keep a completed copy.');
 heading('Send your completed application');
 const recipients=(config.submissionRecipients?.length?config.submissionRecipients:[config.submissionEmail]).filter(Boolean);
 if(config.canSubmit){
  paragraph('When completing the application online, review the recipients and use Submit application. A download or saved progress file alone does not submit it. You can also email the completed PDF and required materials to the recipient below.');
 }else{
  paragraph('Online submission is not connected yet. Download your completed, signed PDF and email it with the required materials to the recipient below. Saving progress or downloading a PDF does not submit an application.');
 }
 paragraph(`${recipients.length===1?'Application recipient':'Application recipients'}: ${recipients.join(', ')}`,{face:bold});
 paragraph(`Email your digital photo separately to: ${config.photoEmail}.`);
 paragraph('The online form can combine selected supporting PDF, JPG and PNG files with your completed application. Keep original certificate-signed PDFs separate. Reselect supporting files when you reopen saved progress.');
 heading('Questions');
 paragraph([content.email,content.phone].filter(Boolean).join(' | '));
 paragraph(content.address);
 paragraph('Thank you for your interest.\nThe Fox Chapel Golf Club Scholarship Foundation',{gap:10});
 paragraph('This scholarship is not an employee bonus. Applying does not guarantee an interview or a scholarship.');
}
window.FCGCPdf={async create(data,config,{blank=false,labels={}}={}){
 data=FCGCAnswers.normalize(data);
 const {PDFDocument,StandardFonts,PDFName,rgb}=PDFLib;
 const [template,patchResponse]=await Promise.all([fetch('application.pdf?v=20261102-2'),fetch('pdf-settings.json?v=20261102-2')]);
 if(!template.ok||!patchResponse.ok)throw new Error('The application template could not load. Your answers are still here.');
 const doc=await PDFDocument.load(await template.arrayBuffer()),form=doc.getForm();
 const font=await doc.embedFont(StandardFonts.TimesRoman),bold=await doc.embedFont(StandardFonts.TimesRomanBold);
 const fields=new Map(form.getFields().map(f=>[f.getName(),f])),overflow=[];
 const clean=s=>String(s??'').replace(/\r\n?/g,'\n').replace(/\t/g,' ');
 function wrap(text,width,size=9){const result=[];for(const para of clean(text).split('\n')){if(!para){result.push('');continue;}let line='';for(const word of para.split(/\s+/)){if(font.widthOfTextAtSize((line?line+' ':'')+word,size)<=width){line+=(line?' ':'')+word;continue;}if(line){result.push(line);line='';}let rest=word;while(font.widthOfTextAtSize(rest,size)>width){let n=1;while(n<rest.length&&font.widthOfTextAtSize(rest.slice(0,n+1),size)<=width)n++;result.push(rest.slice(0,n));rest=rest.slice(n);}line=rest;}result.push(line);}return result;}
 function encode(text,label){try{font.encodeText(clean(text).replaceAll('\n',' '));}catch{throw new Error(`The answer for ${label} has a symbol this PDF cannot print. Replace emoji or unusual symbols and try again.`);}}
 for(const patch of await patchResponse.json()){
  const page=doc.getPage(patch.page),value=patch.kind==='year'?config.year+(patch.suffix||''):patch.kind==='academicYear'?`${config.year}-${Number(config.year)+1}`:patch.kind==='photo'?`A digital photo of the applicant should be emailed to: ${config.photoEmail}`:patch.kind==='destination'?`Submit this application and the required documents to: ${config.submissionEmail}`:`Deadline: ${config.deadline}`;
  const face=patch.bold?bold:font;encode(value,patch.kind);let size=patch.size;
  while(size>6.5&&face.widthOfTextAtSize(value,size)>patch.width)size-=.1;
  page.drawRectangle({x:patch.x,y:patch.y,width:patch.width,height:patch.height,color:rgb(1,1,1)});
  page.drawText(value,{x:patch.x+.5,y:patch.y+2,size,font:face,color:patch.kind==='photo'?rgb(.75,0,0):rgb(0,0,0)});
 }
 for(const f of fields.values())if(f instanceof PDFLib.PDFTextField){f.removeMaxLength();f.setFontSize(9);}
 function setText(name,value){const f=fields.get(name);if(!(f instanceof PDFLib.PDFTextField))return;let text=clean(value);encode(text,labels[name]||name.replaceAll('_',' '));const rect=f.acroField.getWidgets()[0].getRectangle();let size=9;
  if(f.isMultiline()){if(wrap(text,rect.width-5).length>Math.floor(rect.height/10)){overflow.push(`${labels[name]||name.replaceAll('_',' ')}: ${text}`);text='See Additional Information.';}}
  else{while(size>7&&font.widthOfTextAtSize(text,size)>rect.width-5)size-=.25;if(font.widthOfTextAtSize(text,size)>rect.width-5){overflow.push(`${labels[name]||name.replaceAll('_',' ')}: ${text}`);text=rect.width<65?'*':'See addl. info.';size=7;}}
  f.setFontSize(size);f.setText(text);
 }
 const paired=new Set([...fields.keys()].filter(n=>n.endsWith('_continued')).map(n=>n.slice(0,-10)));
 for(const [name,value] of Object.entries(data)){
  if(name==='additional_information'||name==='signatures'||paired.has(name)||name.startsWith('annual_')||/^aid_\d_amount$/.test(name)||name.endsWith('_typed_name'))continue;
  const f=fields.get(name);if(!f)continue;
  if(f instanceof PDFLib.PDFCheckBox){if(value)f.check();}
  else if(f instanceof PDFLib.PDFRadioGroup){if(value==='Yes'||value==='No')f.select(value);}
  else setText(name,value);
 }
 for(const name of paired){const text=clean(data[name]);encode(text,labels[name]||name);const first=fields.get(name),second=fields.get(name+'_continued');const lines=wrap(text,first.acroField.getWidgets()[0].getRectangle().width-5);let a=lines.shift()||'',b=lines.join(' ');if(wrap(b,second.acroField.getWidgets()[0].getRectangle().width-5).length>1){overflow.push(`${labels[name]||name.replaceAll('_',' ')}: ${text}`);a='See Additional Information.';b='';}first.setText(a);second.setText(b);}
 if(!blank){const totals=window.scholarship.totals(data);if(!totals)throw new Error('Check the highlighted dollar amounts.');for(const name of window.scholarship.moneyNames)setText(name,(window.scholarship.cents(data[name])/100).toFixed(2));for(const [name,value] of Object.entries(totals))setText(name,(value/100).toFixed(2));}
 const extra=[clean(data.additional_information),...overflow].filter(Boolean).join('\n\n');let lines=wrap(extra,430);
 for(let i=1;i<=27;i++)setText(`additional_information_line_${String(i).padStart(2,'0')}`,lines.shift()||'');
 while(lines.length){const page=doc.addPage([612,792]);page.drawText('Additional Information (continued)',{x:50,y:742,size:14,font:bold});for(let y=714;lines.length&&y>54;y-=15)page.drawText(lines.shift(),{x:50,y,size:9,font});}
 const signed=[],drawnSignatures=[];
 for(const [role,fieldName] of [['student','student_typed_name'],['parent','parent_guardian_typed_name']]){
  const signature=data.signatures?.[role];if(!signature)continue;
  const box=fields.get(fieldName).acroField.getWidgets()[0].getRectangle();encode(signature.name,`${role} signature`);
  if(signature.image){const image=await doc.embedPng(signature.image);const scale=Math.min(box.width/image.width,box.height/image.height);drawnSignatures.push({image,box:{x:box.x,y:box.y,width:image.width*scale,height:image.height*scale}});}
  else setText(fieldName,signature.name);
  signed.push(`${role==='student'?'Student':'Parent / guardian'}: ${signature.name} - electronically signed ${new Date(signature.at).toLocaleString('en-US',{timeZone:'America/New_York'})} ET`);
 }
 if(signed.length){const page=doc.getPage(3);page.drawText('Electronic signatures applied by the signers with their consent.',{x:89,y:256,size:8,font});signed.forEach((line,i)=>{let size=8;while(size>6&&font.widthOfTextAtSize(line,size)>435)size-=.25;page.drawText(line,{x:89,y:244-i*12,size,font});});}
 form.updateFieldAppearances(font);
 if(!blank){form.flatten();for(const page of doc.getPages())page.node.delete(PDFName.of('Annots'));doc.catalog.delete(PDFName.of('AcroForm'));}
 // Flattened empty-field appearances can be opaque. Paint signatures last.
 for(const {image,box} of drawnSignatures)doc.getPage(3).drawImage(image,box);
 // Insert instruction pages last so the approved application and signature page indexes stay unchanged.
 if(blank)await prependFoundationInstructions(doc,config);
 doc.catalog.delete(PDFName.of('StructTreeRoot'));doc.catalog.delete(PDFName.of('MarkInfo'));
 doc.setTitle(`${config.year} Fox Chapel Scholarship Application${blank?' and Instructions':''}`);doc.setAuthor('Fox Chapel Golf Club Scholarship Foundation, Inc.');
 return doc.save();
}};
