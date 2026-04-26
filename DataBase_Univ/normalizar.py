import json

def normalize_tipo(tipo):
    # Diccionario para unificar los nombres de los tipos de asignatura
    mapping = {
        "OB": "Obligatoria",
        "OP": "Optativa",
        "Básica": "Básica",
        "Obligatoria": "Obligatoria",
        "Optativa": "Optativa"
    }
    return mapping.get(tipo, tipo) # Si no está en el mapa, devuelve el original

def clean_text(text):
    if isinstance(text, str):
        return text.replace('\n', ' ').strip()
    return text

def normalize_data(data):
    # Recorre toda la estructura del JSON
    if 'universidades' in data:
        for uni in data['universidades']:
            for prog in uni.get('programas', []):
                # Limpiar el título
                if 'titulo' in prog:
                    prog['titulo'] = clean_text(prog['titulo'])
                
                # Función recursiva para buscar campos en cualquier profundidad del JSON
                def traverse(item):
                    if isinstance(item, list):
                        for i in item:
                            traverse(i)
                    elif isinstance(item, dict):
                        if 'asignatura' in item:
                            item['asignatura'] = clean_text(item['asignatura'])
                        if 'tipo' in item:
                            item['tipo'] = normalize_tipo(item['tipo'])
                        for key in item:
                            traverse(item[key])
                
                traverse(prog.get('plan_estudios', {}))
    return data

# Cargar, procesar y guardar
with open('baseDatosUPC_selenium.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
    normalized = normalize_data(data)
    with open('normalized_UPC.json', 'w', encoding='utf-8') as f_out:
        json.dump(normalized, f_out, indent=2, ensure_ascii=False)