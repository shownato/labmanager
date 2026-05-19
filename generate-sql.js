let sql = 'INSERT INTO pc_status (pc_name, lab_id, status) VALUES\n';
const values = [];
for(let lab=1; lab<=10; lab++) {
  const pcCount = (lab === 5 || lab === 7) ? 36 : 31;
  for(let pc=0; pc<pcCount; pc++) {
    values.push(`('LAB${lab*100+pc}', ${lab}, 'ok')`);
  }
}
sql += values.join(',\n') + ';';
console.log(sql);