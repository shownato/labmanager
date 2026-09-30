"""Read a teacher XLSX without editing it; write a private import JSON (stdlib only)."""
import argparse
import json
import posixpath
import re
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REL = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'


def header(value):
    return ''.join(c for c in unicodedata.normalize('NFD', value.lower().strip())
                   if unicodedata.category(c) != 'Mn')


def read_teachers(source, sheet_name):
    with zipfile.ZipFile(source) as archive:
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            strings = [''.join(t.text or '' for t in item.findall('.//s:t', NS))
                       for item in ET.fromstring(archive.read('xl/sharedStrings.xml'))]
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        sheets = workbook.findall('s:sheets/s:sheet', NS)
        sheet = next((s for s in sheets if s.attrib['name'] == sheet_name), None)
        if sheet is None:
            raise ValueError('Aba solicitada não encontrada.')
        relationships = ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
        target = next(r.attrib['Target'] for r in relationships if r.attrib['Id'] == sheet.attrib[REL])
        target = target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/' + target)
        root = ET.fromstring(archive.read(target))
        rows = []
        for row in root.findall('s:sheetData/s:row', NS):
            values = {}
            for cell in row.findall('s:c', NS):
                column = re.sub(r'[0-9]', '', cell.attrib['r'])
                kind = cell.attrib.get('t', 'n')
                value = cell.findtext('s:v', '', NS)
                if kind == 's':
                    value = strings[int(value)]
                elif kind == 'inlineStr':
                    value = ''.join(t.text or '' for t in cell.findall('.//s:t', NS))
                values[column] = (value, kind, cell.find('s:f', NS) is not None)
            if any(v[0].strip() for v in values.values()):
                rows.append((int(row.attrib['r']), values))
        if not rows:
            raise ValueError('Aba vazia.')
        columns = {header(value[0]): col for col, value in rows[0][1].items()}
        if 'matricula' not in columns or 'nome' not in columns:
            raise ValueError('São necessários os cabeçalhos matricula e nome.')
        teachers, seen = [], set()
        for row_number, values in rows[1:]:
            registration, kind, formula = values.get(columns['matricula'], ('', '', False))
            name, _, name_formula = values.get(columns['nome'], ('', '', False))
            registration, name = registration.strip(), name.strip()
            if formula or name_formula:
                raise ValueError(f'Linha {row_number}: fórmula em campo de cadastro; revise a origem.')
            if kind not in ('s', 'inlineStr', 'str'):
                raise ValueError(f'Linha {row_number}: matrícula deve estar armazenada como texto para preservar zeros.')
            if not re.fullmatch(r'[0-9]{6}[0-9.\s-]*', registration) or not name:
                raise ValueError(f'Linha {row_number}: matrícula ou nome inválido.')
            login = registration[:6]
            if login in seen:
                raise ValueError(f'Linha {row_number}: seis primeiros dígitos duplicados; nada foi exportado.')
            seen.add(login)
            teachers.append({'registration': registration, 'fullName': name, 'sourceRow': row_number})
        if not teachers:
            raise ValueError('Nenhum professor encontrado.')
        return teachers


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--sheet', default='Plan1')
    parser.add_argument('--output', type=Path, default=Path('.private/teachers-import.json'))
    args = parser.parse_args()
    teachers = read_teachers(args.source, args.sheet)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation prevents accidentally overwriting a reviewed import.
    with args.output.open('x', encoding='utf-8') as output:
        json.dump({'schemaVersion': 1, 'sourceFile': args.source.name,
                   'sheet': args.sheet, 'teachers': teachers}, output, ensure_ascii=False, indent=2)
    print(f'{len(teachers)} professores; logins únicos; arquivo privado preparado. Nenhuma conta criada.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, zipfile.BadZipFile, ET.ParseError) as error:
        raise SystemExit(str(error))
