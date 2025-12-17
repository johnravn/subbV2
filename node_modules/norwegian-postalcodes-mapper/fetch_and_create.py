import requests
import csv
from io import StringIO

url = "https://www.bring.no/postnummerregister-ansi.txt"

response = requests.get(url)
response.raise_for_status()

data = StringIO(response.text)

csv_reader = csv.reader(data, delimiter="\t")

js_file = "interface PostalCodeInfo {\n"
js_file += "  city: string;\n"
js_file += "  municipality: string;\n"
js_file += "}\n"

js_file += "const postalCodeMap: Record<string, PostalCodeInfo> = {\n"
for row in csv_reader:
    postnummer, poststed, kommunekode, kommune, _ = row
    js_file += f'  "{postnummer}": {{ "city": "{poststed}", "municipality": "{kommune}" }},\n'
    print(postnummer, poststed)
js_file += "};\n"

js_file += "export function getPostalCodeInfo(postalCode: string): PostalCodeInfo | undefined {\n"
js_file += "  const info = postalCodeMap[postalCode];\n"
js_file += "  if (!info) {\n"
js_file += '    return undefined;\n'
js_file += "  }\n"
js_file += "  return info;\n"
js_file += "}\n"

with open("./src/index.ts", "w") as file:
    file.write(js_file)
