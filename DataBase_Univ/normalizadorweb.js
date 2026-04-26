function normalizarProgramas(universidadesJson) {
  const programasNormalizados = [];

  universidadesJson.forEach(uni => {
    uni.programas.forEach(prog => {
      // 1. Omitir programas vacíos o que solo tengan estado de "Soon"
      if (prog.estado === "Soon" || !prog.plan_estudios || Object.keys(prog.plan_estudios).length === 0) {
        return; 
      }

      let asignaturasPlanas = [];

      // Función recursiva para buscar arreglos de asignaturas en cualquier nivel de profundidad
      function extraerAsignaturas(nodo, nivel1 = "Desconocido", nivel2 = "Desconocido") {
        for (const clave in nodo) {
          const valor = nodo[clave];

          if (Array.isArray(valor)) {
            // Hemos encontrado un nivel con asignaturas (ej. cuatrimestre_1, anual, Materia I...)
            valor.forEach(asig => {
              asignaturasPlanas.push({
                asignatura: asig.asignatura || "Sin nombre",
                ects: asig.ects === 0 ? "No especificado" : (asig.ects || "No especificado"),
                tipo: asig.tipo || "Desconocido",
                modalidad: asig.modalidad || "No especificada", // Rellena el hueco de la UPC
                // Guardamos el contexto de dónde venía para poder agrupar en la web
                agrupacion_principal: nivel1.replace(/_/g, " ").toUpperCase(), 
                agrupacion_secundaria: clave.replace(/_/g, " ").toUpperCase() 
              });
            });
          } else if (typeof valor === "object" && valor !== null) {
            // Si es un objeto (ej. año_1, o mencion_x), entramos un nivel más
            extraerAsignaturas(valor, clave, nivel2);
          }
        }
      }

      extraerAsignaturas(prog.plan_estudios);

      // 2. Construir el programa final limpio
      programasNormalizados.push({
        titulo: prog.titulo,
        tipo: prog.tipo,
        universidad: prog.universidad || uni.nombre_universidad,
        url: prog.url || "",
        plan_estudios: asignaturasPlanas
      });
    });
  });

  return programasNormalizados;
}