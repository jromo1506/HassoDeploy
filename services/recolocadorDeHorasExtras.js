const HorasTrabajadas = require('../models/HorasTrabajadas');
const exportadorDeHoras = require('../services/exportadorDeHorasExtrasService.js');
const Nomina = require('../models/Nomina.js');
const mongoose = require('mongoose');
const Decimal = require('decimal.js');



/*
PASOS PARA RECOLOCAR LAS HORAS
1 - La semana debe estar completa (con o sin horas extras)
2 - Contar todas las horas (extras y regulares juntas) y determinar si se cumplen o no las 48
    - Si no se cumplen y hay horas extras se tienen que realocar
    - Si exactamente se cumplen 48 y hay horas extras se tiene que realocar
    - Si se completan las horas pero hay horas extras que deben de convertise en regules
      y se debe realocar el numero de horas extras que se necesitan para completar paso 4



    REALOCAR
3 - Se obtienen las horas extras del dia mas lejano (De Lunes a viernes) 
3.1 Dentro de ese dia de obtiene la hora extra mas lejana (Mas temprano a mas tarde)
3.2 Evaluar si esas horas son suficientes para completar las horas extras
3.3 Buscar en ese mismo dia de esa misma hora si hay un resgitro de horas en ese mismo proyecto
    -Si existe: Las horas extras se transfieren a ese registro y se elimina el registro de horas extras transferido
    -Si no existe: Cambiar las horas extras a regulares


3.3 Se vuelve a repetir el paso 2 hasta que no se nececite recolocar



[TODOS ESTOS CAMBIOS DEBEN MATENER SU FECHA Y HORA DE CREACION, DE OTRA FORMA CAUSARAN UN DESACOMOO]
    A- Si no son suficientes para completar las 48  solo se convierten en regulares
    B- Si son suficientes para completar exactamente 48 solo se convierten en regulares
    C- Si son suficientes para completar (sobrepasandolas) se dividen dichas horas extras en
      las regulares para completar y las extras sobrantes, se restan a las horas faltantes. La diferencia
      se convierte en extras y se le resta a las extras para obtener las regulares
3.3 Se vuelve a repetir el paso 2 hasta que no se nececite recolocar


4 - Si se completan mas de 48 horas pero no cuenta con 48 horas regulares
    hay que averiguar el numero de horas extras que se deben convertir en
    regulares para que se completen las 48 y el resto dejarlas asi

4.1 Obtener el num de horas regulares y de extras.
4.2 Comparar si las horas regulares superan las 48 horas
    - Si superan las 48 horas no se hace nada
    - Si no las supera las 48 restar a 48 las horas regulares
      eso te da el numero de horas extras que se deben de convertir
      y se llama al realocador por horas

REALOCADOR POR HORAS
4.3 Obtiene la hora mas temprana del dia mas lejano
4.4 Checa si las horas trabajadas de esa hora son suficientes para
    llenar las horas a converir
(checando si existe un registro y disminuye el num de horas extras faltantes)
        -Si no son suficientes se convierten en regulares y se vuelve a llamar a la funcion
        -Si son suficientes y sobrepasan el numero el numero de horas extras
         se convierten en regulares y el sobrante se queda como extra y se sale del ciclo
        -Si son suficientes exactamene se convierten en regulares y se sale del ciclo


PARA EL CASO EN QUE LAS HORAS REGULARES SUPERAN LAS 48 HORAS
1 - Se evalua cuantas horas sobran ej. 49 - 48 = 1
2 - Buscar las ultimas horas regulas mas cercanas al viernes actual
3 - Luego de esas horas obtener la hora mas tarde (mas noche)
4 - Se resta a esa hora el sobrante pero hay 3 casos:
    A - Cuando el sobrante supera a las horas regulares
    B - Cuando el sobrante es exactamente la hora regular
    C - Cuano el sobrante es menor a la hora

    [PARA CADA CASO HACER EL CHEQUEO DE SI HAY UN PROYECTO IGUAL O NO]
    Caso A Supera:
        - La hora reglar se convierte en extra y se restan esas horas al sobrante
        - Se vuelve a ciclar
    Caso B Exacto:
        - La hora regular se convierte en extra y se sale del recolocador
    Caso C No supera:
        - Se le resta el sobrante al la hora, el resultado de la resta se convierte en extra
          y se crea un clon donde el sobrante que se resto es regular ej. 5 - 3 = 2 
          (2 extra 3 regular) se sale del ciclo despues de eso



- 
*/



// OBTIENE EL TOTAL DE HORAS TRABAJADAS
const obtenerTotalHorasTrabajadas = async(idSemana, idEmpleado) => {
    try {
      // Consulta para obtener las horas del empleado en la semana específica
      const horasTrabajadas = await HorasTrabajadas.find({
        idEmpleado,
        idSemana,
      });
  
      // Suma todas las horas trabajadas
      const totalHoras = horasTrabajadas.reduce((total, registro) => {
        return total + registro.horasTrabajadas;
      }, 0);
  
      return totalHoras;
    } catch (error) {
      console.error("Error al obtener las horas trabajadas:", error);
      throw error;
    }
  }



// EVALUA SI HAY HORAS EXTRAS EN LA SEMANA
const tieneHorasExtras = async (idSemana, idEmpleado) => {
    try {
        // Consulta en la base de datos
        const horasExtras = await HorasTrabajadas.findOne({
            idSemana: idSemana,
            idEmpleado: idEmpleado,
            sonHorasExtra: true
        });

        // Si encuentra un registro, devuelve true
        return !!horasExtras;
    } catch (error) {
        console.error('Error al verificar horas extras:', error);
        throw new Error('Error al verificar horas extras');
    }
};




// OBTIENE TODAS LAS HORAS DEL DIA MAS CERCANO
const obtenerHorasExtras = async (idSemana, idEmpleado) => {
    try {
        // Definir el orden relativo de los días de la semana
        const ordenDias = [
            "Viernes anterior",  // Más lejano
            "Sabado anterior",
            "Domingo anterior",
            "Lunes",
            "Martes",
            "Miercoles",
            "Jueves" // Más cercano
        ];

        // Obtener todas las horas extras del trabajador en esa semana
        const horas = await HorasTrabajadas.find({ idSemana, idEmpleado, sonHorasExtra: true });

        if (horas.length === 0) {
            console.log("No se encontraron horas extras para ese empleado y semana.");
            return [];
        }

        // Ordenar las horas según el campo diaSemana basado en ordenDias
        horas.sort((a, b) => {
            return ordenDias.indexOf(a.diaSemana) - ordenDias.indexOf(b.diaSemana);
        });

        // Filtrar las horas del día más lejano según el orden
        const diaMasLejano = horas[0].diaSemana; // El primer elemento tras ordenar
        const horasDelDiaMasLejano = horas.filter(hora => hora.diaSemana === diaMasLejano);
       
        return horasDelDiaMasLejano;
    } catch (error) {
        console.error("Error al obtener las horas extras:", error);
        return [];
    }
};


// OBTIENE LA HORA TRABAJADA CON LA HORA MAS TEMPRANA
const obtenerHoraMasTempranaDelDia = async (registros) =>{
    try{
        if (!Array.isArray(registros) || registros.length === 0) {
            throw new Error('El array de registros está vacío o no es válido.');
        }
    
        // Ordenar los registros por horaCreacion en orden ascendente (de más antigua a más reciente)
        const registrosOrdenados = registros.sort((a, b) => new Date(a.horaCreacion) - new Date(b.horaCreacion));
    
        // Retornar el primer registro (el más antiguo)
        return registrosOrdenados[0];
    }
    catch(error){

    }
}


const buscarSiHayHorasRegularesParaEseProyectoEnEseMismoDia = async(horaSemejante)=>{
    try {
        const { idSemana, idProyecto, idEmpleado, diaSemana } = horaSemejante;
        // Buscar en la base de datos
        const registroEncontrado = await HorasTrabajadas.findOne({
            idSemana,
            idProyecto,
            idEmpleado,
            diaSemana,
            sonHorasExtra: false // Buscar específicamente donde `sonHorasExtra` es `false`
        });

        return registroEncontrado;
    } catch (error) {
        console.error('Error al buscar el registro:', error);
        throw error; // Lanza el error para manejarlo en el nivel superior
    }
}

const buscarSiHayHorasExtrasParaEseProyectoEnEseMismoDia = async(horaSemejante)=>{
    try {
        const { idSemana, idProyecto, idEmpleado, diaSemana } = horaSemejante;
        // Buscar en la base de datos
        const registroEncontrado = await HorasTrabajadas.findOne({
            idSemana,
            idProyecto,
            idEmpleado,
            diaSemana,
            sonHorasExtra: true // Buscar específicamente donde `sonHorasExtra` es `false`
        });

        return registroEncontrado;
    } catch (error) {
        console.error('Error al buscar el registro:', error);
        throw error; // Lanza el error para manejarlo en el nivel superior
    }
}

// TRANSFIERE LAS HORAS DE UN HORARIO  A OTRO SI HAY PROYECTOS
const transferirHorasYEliminar = async(idHorarioOrigen,idHorarioDestino) =>{
    try {
        // Buscar ambos horarios
        const horarioOrigen = await HorasTrabajadas.findById(idHorarioOrigen);
        const horarioDestino = await HorasTrabajadas.findById(idHorarioDestino);

        if (!horarioOrigen || !horarioDestino) {
            throw new Error('Uno o ambos horarios no existen.');
        }

        // Sumar las horas del origen al destino
        horarioDestino.horasTrabajadas += horarioOrigen.horasTrabajadas;

        // Guardar el horario destino con las horas actualizadas
        await horarioDestino.save();

        // Eliminar el horario origen
        await HorasTrabajadas.findByIdAndDelete(idHorarioOrigen);

        return {
            success: true,
            message: 'Horas transferidas exitosamente.',
            horarioDestinoActualizado: horarioDestino
        };
    } catch (error) {
        console.error('Error durante la transferencia de horas:', error);
        return {
            success: false,
            message: 'Ocurrió un error durante la transferencia de horas.',
            error: error.message
        };
    }
}


// SWITCHEA ENTRE TRUE O FALSE PARA UNA HORA 
const cambiarSonHorasExtra = async (idHorario, nuevoValor) => {
    try {
        // Validar que el valor sea booleano
        if (typeof nuevoValor !== 'boolean') {
            throw new Error('El valor de `sonHorasExtra` debe ser un booleano.');
        }

        // Buscar y actualizar el documento
        const resultado = await HorasTrabajadas.findByIdAndUpdate(
            idHorario,
            { sonHorasExtra: nuevoValor },
            { new: true } // Devuelve el documento actualizado
        );

        if (!resultado) {
            throw new Error('No se encontró un horario con el ID proporcionado.');
        }

        return {
            success: true,
            message: 'El campo sonHorasExtra fue actualizado exitosamente.',
            data: resultado
        };
    } catch (error) {
        console.error('Error al actualizar sonHorasExtra:', error);
        return {
            success: false,
            message: 'Ocurrió un error al actualizar sonHorasExtra.',
            error: error.message
        };
    }
};


// OBTIENE LA SUMA DE HORAS EXTRAS 
const obtenerSumaHorasExtras = async (idSemana, idEmpleado) => {
    try {
        // Usamos el método aggregate para realizar la suma de las horas extras
        const resultado = await HorasTrabajadas.aggregate([
            // Filtro de semana e idEmpleado
            { 
                $match: {
                    idSemana: idSemana,
                    idEmpleado: idEmpleado,
                    sonHorasExtra: true // Solo consideramos las horas extras
                }
            },
            // Sumar las horasTrabajadas
            {
                $group: {
                    _id: null, // No necesitamos un campo de agrupación, solo sumaremos
                    totalHorasExtras: { $sum: "$horasTrabajadas" } // Sumar todas las horasTrabajadas
                }
            }
        ]);

        // Si no se encuentran horas extras, devolvemos 0
        if (resultado.length === 0) {
            return 0;
        }

        // Devuelve la suma de las horas extras
        return resultado[0].totalHorasExtras;
    } catch (error) {
        console.error("Error al obtener la suma de horas extras:", error);
        return 0;
    }
};

// OBTIENE LA SIMA DE HORAS REGULARES
const obtenerSumaHorasRegulares = async (idSemana, idEmpleado) => {
    try {
        // Usamos el método aggregate para realizar la suma de las horas regulares
        const resultado = await HorasTrabajadas.aggregate([
            // Filtro de semana e idEmpleado
            { 
                $match: {
                    idSemana: idSemana,
                    idEmpleado: idEmpleado,
                    sonHorasExtra: false // Solo consideramos las horas regulares
                }
            },
            // Sumar las horasTrabajadas
            {
                $group: {
                    _id: null, // No necesitamos un campo de agrupación, solo sumaremos
                    totalHorasRegulares: { $sum: "$horasTrabajadas" } // Sumar todas las horasTrabajadas
                }
            }
        ]);

        // Si no se encuentran horas regulares, devolvemos 0
        if (resultado.length === 0) {
            return 0;
        }

        // Devuelve la suma de las horas regulares
        return resultado[0].totalHorasRegulares;
    } catch (error) {
        console.error("Error al obtener la suma de horas regulares:", error);
        return 0;
    }
};

// DETERMINA EL CASO DE PROBLEMA PARA LAS HORAS FALTANTES
const compararHorasTrabajadas = async (idHora, horasFaltantes) => {
    try {
        // Obtén la hora trabajada específica
        const hora = await HorasTrabajadas.findById(idHora);

        if (!hora) {
            return 'No se encontró la hora trabajada con el ID proporcionado.';
        }
        console.log(hora.horasTrabajadas + "  " + horasFaltantes);
        // Compara las horas trabajadas con las horas faltantes y devuelve el mensaje correspondiente
        if (hora.horasTrabajadas > horasFaltantes) {
            return 'Superan';
        } else if (hora.horasTrabajadas < horasFaltantes) {
            return 'NoSuperan';
        } else {
            return 'Exacto';
        }
    } catch (error) {
        console.error("Error al comparar la hora trabajada:", error);
        return 'Error al obtener o comparar la hora trabajada.';
    }
};

// TODO: SOLUCIONES PARA CADA UNO DE LOS 3 CASOS


const solucionSuperaHoras = async(idSemana,idEmpleado,horasFaltantes,horaMasCercanaDia)=>{
    horasTrabajadas=horaMasCercanaDia.horasTrabajadas;
    // Las horas extras que van a sobrar
    horasExtrasSobrantes = horasTrabajadas - horasFaltantes;
    // Las horas regulares (Se les tiene que hacer el proceso de buscar hora semejante)
    horasASumar = horasTrabajadas - horasExtrasSobrantes;

    console.log("Horas extras sobrantes. "+ horasExtrasSobrantes + " horas extras regulares" + horasASumar);


    /*
    Para las horas regulares hay dos casos. el caso en el que ya hay horas regulares
    de ese proyecto y solo se le suman o el caso en el que no hay
    para ese caso se debe crear un clon de las horasExtras pero con el sobrante
    de horas regulares 
    */
    // // Busca si hay horas regulares ese día en el mismo proyecto
    const horaSemejanteRegular = await buscarSiHayHorasRegularesParaEseProyectoEnEseMismoDia(horaMasCercanaDia);
    
    if(horaSemejanteRegular!=null){
        await sumarHorasTrabajadas(horaSemejanteRegular._id,horasASumar);
    }
    else{
        await clonarHoras(horaMasCercanaDia,horasASumar);
    }
    await actualizarHorasTrabajadas(horaMasCercanaDia._id,horasExtrasSobrantes);
    return 0;
}


const clonarHoras = async (originalDocumento, nuevasHoras) => {
    try {
        // Convierte el documento original en un objeto y elimina el campo `_id`
        const documentoSinId = { ...originalDocumento.toObject() };
        delete documentoSinId._id; // Elimina el campo `_id` para evitar conflictos

        // Crea un nuevo objeto basado en el documento original
        const nuevoDocumento = new HorasTrabajadas({
            ...documentoSinId,             // Copia todos los campos excepto `_id`
            horasTrabajadas: nuevasHoras,  // Cambia las horas trabajadas
            sonHorasExtra: false,          // Asegúrate de que sea `false`
            _id: new mongoose.Types.ObjectId(), // Genera un nuevo ID válido
            horaCreacion: Date.now()       // Actualiza la hora de creación
        });

        // Guarda el nuevo documento en la base de datos
        await nuevoDocumento.save();
        return nuevoDocumento;
    } catch (error) {
        throw new Error(`Error al clonar el documento: ${error.message}`);
    }
};

const sumarHorasTrabajadas = async (idHora, cantidadASumar) => {
    try {
        const resultado = await HorasTrabajadas.findByIdAndUpdate(
            idHora, 
            { $inc: { horasTrabajadas: cantidadASumar } }, // Incrementa las horas trabajadas
            { new: true, runValidators: true } // Retorna el documento actualizado y valida el esquema
        );
        return resultado;
    } catch (error) {
        throw new Error(`Error al actualizar las horas trabajadas: ${error.message}`);
    }
};

const actualizarHorasTrabajadas = async(idHora,nuevaCantidad)=>{
    try {
        const resultado = await HorasTrabajadas.findByIdAndUpdate(
            idHora, 
            { horasTrabajadas:nuevaCantidad }, 
            { sonHorasExtra:true},
            { new: true, runValidators: true } // Retorna el documento actualizado y valida el esquema
        );
        return resultado;
    } catch (error) {
        throw new Error(`Error al actualizar las horas trabajadas: ${error.message}`);
    }
}



const solucionNoSuperan = async(idSemana,idEmpleado,horasFaltantes,horaMasCercanaDia) => {
    try{
        horasTrabajadas=horaMasCercanaDia.horasTrabajadas;
        horasExtrasSobrantes = horasFaltantes - horasTrabajadas;

        // Las horas regulares (Se les tiene que hacer el proceso de buscar hora semejante)
        // horasRegulares = horasTrabajadas - horasExtrasSobrantes;


        console.log(horasExtrasSobrantes + " horas extras que faltan por normalizar");
        const horaSemejanteRegular = await buscarSiHayHorasRegularesParaEseProyectoEnEseMismoDia(horaMasCercanaDia);
    
        if(horaSemejanteRegular!=null){
            await transferirHorasYEliminar(horaMasCercanaDia._id,horaSemejanteRegular._id);
        }
        else{
            await cambiarSonHorasExtra(horaMasCercanaDia._id,false);
        }
       

        

        // console.log(horasExtrasSobrantes + "Horas regulares");
        return horasExtrasSobrantes;
    }
    catch(error){
        throw new Error(`Error al actualizar las horas trabajadas: ${error.message}`);

    }
}


const solucionExacto = async(idSemana,idEmpleado,horasFaltantes,horaMasCercanaDia) =>{
    try{
        horasTrabajadas=horaMasCercanaDia.horasTrabajadas;
        horasExtrasSobrantes = horasTrabajadas - horasFaltantes;

        // Las horas regulares (Se les tiene que hacer el proceso de buscar hora semejante)
        const horaSemejanteRegular = await buscarSiHayHorasRegularesParaEseProyectoEnEseMismoDia(horaMasCercanaDia);
    
        if(horaSemejanteRegular!=null){
            await transferirHorasYEliminar(horaMasCercanaDia._id,horaSemejanteRegular._id);
        }
        else{
            await cambiarSonHorasExtra(horaMasCercanaDia._id,false);
        }
      
    
        // console.log(horasExtrasSobrantes + "Horas regulares");
        return 0;
    }
    catch(error){
        throw new Error(`Error al actualizar las horas trabajadas: ${error.message}`);

    }
}


const obtenerHoraRegularesMasLejana = async (idSemana, idEmpleado) => {
    try {

        // Definir el orden relativo de los días de la semana (del más cercano al más lejano al viernes)
        const ordenDias = [
            "Viernes",       // Más cercano al viernes
            "Jueves",       
            "Miercoles",
            "Martes",
            "Lunes",
            "Domingo anterior",
            "Sabado anterior",
            "Viernes anterior" // Más lejano
        ];

        // Obtener todas las horas regulares del trabajador en esa semana
        const horas = await HorasTrabajadas.find({ idSemana, idEmpleado, sonHorasExtra: false });

        if (horas.length === 0) {
            console.log("No se encontraron horas regulares para ese empleado y semana.");
            return [];
        }

        // Ordenar las horas según el campo diaSemana basado en ordenDias
        horas.sort((a, b) => {
            return ordenDias.indexOf(a.diaSemana) - ordenDias.indexOf(b.diaSemana);
        });

        // Filtrar las horas del día más cercano al viernes según el orden
        const diaMasCercano = horas[0].diaSemana; // El primer elemento tras ordenar
        const horasDelDiaMasCercano = horas.filter(hora => hora.diaSemana === diaMasCercano);

        return horasDelDiaMasCercano;
    } catch (error) {
        console.error("Error al obtener las horas regulares:", error);
        return [];
    }
};



// SOLUCUION PARA HORAS REGULARES


const obtenerHoraMasTardiaDelDia = async (registros) => {
    try {
        if (!Array.isArray(registros) || registros.length === 0) {
            throw new Error('El array de registros está vacío o no es válido.');
        }

        // Ordenar los registros por horaCreacion en orden descendente (de más reciente a más antigua)
        const registrosOrdenados = registros.sort((a, b) => new Date(b.horaCreacion) - new Date(a.horaCreacion));

        // Retornar el primer registro (el más reciente)
        return registrosOrdenados[0];
    } catch (error) {
        console.error('Error al obtener la hora más tardía:', error);
        throw error;
    }
};

const determinarTipoProblema = async(horasFaltantes,horaMasTardia) =>{
    try{
        console.log("Comparando " + horaMasTardia.horasTrabajadas + " con " + horasFaltantes)
        // Caso 1 Faltante Supera
        if(horaMasTardia.horasTrabajadas < horasFaltantes){
            return "Superan";
        }
        // Caso 2 Faltante exacto
        else if(horaMasTardia.horasTrabajadas == horasFaltantes){
            return "Exacto";
        }
        //Caso 3 Faltante No supera
        else{
            return "NoSuperan";
        }
    
    }
    catch(error){
        throw error;
    }
}

const solucionSuperan_Regular = async(horasFaltantes,horaMasTardia) => {
    const horaSemejante = await buscarSiHayHorasExtrasParaEseProyectoEnEseMismoDia(horaMasTardia);
    
    if(horaSemejante!=null){
        await transferirHorasYEliminar(horaMasTardia._id,horaSemejante._id);
    }
    else{ 
        if(horaMasTardia.diaSemana=="Viernes"){
            console.log("Lo que se deberia de borrar");
            await exportadorDeHoras.transferirHorasTrabajadas(horaMasTardia);
            await eliminarHorasTrabajadas(horaMasTardia);
        }
        else{
            await cambiarSonHorasExtra(horaMasTardia._id,true);
        }
    }
    return horasFaltantes - horaMasTardia.horasTrabajadas;

}



const  solucionExacto_Regular = async(horasFaltantes,horaMasTardia) => {
    console.log("EXACTO");
    const horaSemejante = await buscarSiHayHorasExtrasParaEseProyectoEnEseMismoDia(horaMasTardia);

    if(horaSemejante!=null){
        await transferirHorasYEliminar(horaMasTardia._id,horaSemejante._id);
    }
    else{
        if(horaMasTardia.diaSemana=="Viernes"){
            await exportadorDeHoras.transferirHorasTrabajadas(horaMasTardia);
            await eliminarHorasTrabajadas(horaMasTardia);
        }
        else{
            await cambiarSonHorasExtra(horaMasTardia._id,true);
        }
    }
    return 0;
}


const solucionNoSuperan_Regular = async (horasFaltantes,horaMasTardia) => {
    horasRegularesRestantes = horaMasTardia.horasTrabajadas - horasFaltantes;
    const horaSemejante = await buscarSiHayHorasExtrasParaEseProyectoEnEseMismoDia(horaMasTardia);
  
  
    if(horaSemejante!=null){
        await sumarHorasTrabajadas(horaSemejante,horasFaltantes);
    }
    else{
   
        if(horaMasTardia.diaSemana=="Viernes"){
            
            await exportadorDeHoras.darDeAltaHorasClonadas(horaMasTardia,horasFaltantes);           

        }else{
            await clonarHoras_Regular(horaMasTardia,horasFaltantes);

        }
    }
    await actualizarHorasTrabajadasRegulares(horaMasTardia._id,horasRegularesRestantes);
    return horasRegularesRestantes;
}



const actualizarHorasTrabajadasRegulares = async(idHora,nuevaCantidad)=>{
    try {
        const resultado = await HorasTrabajadas.findByIdAndUpdate(
            idHora, 
            { horasTrabajadas:nuevaCantidad }, 
            { sonHorasExtra:false},
            { new: true, runValidators: true } // Retorna el documento actualizado y valida el esquema
        );
        return resultado;
    } catch (error) {
        throw new Error(`Error al actualizar las horas trabajadas: ${error.message}`);
    }
}

const clonarHoras_Regular = async (originalDocumento, nuevasHoras) => {
    try {
        // Convierte el documento original en un objeto y elimina el campo `_id`
        const documentoSinId = { ...originalDocumento.toObject() };
        delete documentoSinId._id; // Elimina el campo `_id` para evitar conflictos

        // Crea un nuevo objeto basado en el documento original
        const nuevoDocumento = new HorasTrabajadas({
            ...documentoSinId,             // Copia todos los campos excepto `_id`
            horasTrabajadas: nuevasHoras,  // Cambia las horas trabajadas
            sonHorasExtra: true,          // Asegúrate de que sea `false`
            _id: new mongoose.Types.ObjectId(), // Genera un nuevo ID válido
            horaCreacion: Date.now()       // Actualiza la hora de creación
        });

        // Guarda el nuevo documento en la base de datos
        await nuevoDocumento.save();
        return nuevoDocumento;
    } catch (error) {
        throw new Error(`Error al clonar el documento: ${error.message}`);
    }
};



const excepcionViernesParaHorasRegulares = async(tipoProblema) =>{
    switch(tipoProblema){
        case 'Superan':{
            // Solo se hace la conversion y se mandan
            break;
        }
        case 'Exacto':{
            // Solo se hace la conversion y se mandan
            break;
        }
        case 'NoSuperan':{
            // Se clona se elimina y se manda
            break;
        }
        default:{
            console.log("Error");
            break;
        }
    }
}


const eliminarHorasTrabajadas = async (id) => {
    try {
        const resultado = await HorasTrabajadas.findByIdAndDelete(id);
        if (!resultado) throw new Error('Registro no encontrado');
        console.log('Registro eliminado con éxito');
    } catch (error) {
        console.error('Error al eliminar:', error.message);
    }
};



// NORMALIZADOR DE HORAS
/*
 Se encarga de juntar las horas de 2 o mas proyectos en un mismo dia siempre para que solo haya a lo mucho
 1 instancia regular de un proyecto y
 1 instancia extra de un proyecto


*/



const normalizadorDeHoras = async(idSemana,idEmpleado) => {
    try{
        const horas = await HorasTrabajadas.find({idSemana,idEmpleado});
        // console.log(horas,"Nuevas horas");
        await recorrerHorasSemanales(horas,idSemana,idEmpleado);
    }
    catch(error){
        throw error;
    }
}


const recorrerHorasSemanales = async(arrHoras,idSemana,idEmpleado) => {
    try {
        for (let i = 0; i < arrHoras.length; i++) {
            const coincidencias = verificarCoincidencia(arrHoras, arrHoras[i]);
            // console.log(coincidencias,"Las coincidencias");
            if (coincidencias.length > 0) {

                // Agrega el objeto evaluado al array de coincidencias
                coincidencias.push(arrHoras[i]);

                // Llama a la función que manejará las coincidencias
                const objetos = await manejarCoincidencias(coincidencias,arrHoras);
                console.log(objetos.objetosSumados,"objetos a imprimir");
                await modificarRegistro(objetos.objetoFinal._id,objetos.objetoFinal);
                const ids = objetos.objetosSumados.map(obj => obj._id);
                // console.log(ids,"LOS IDSS");
                await eliminarRegistros(ids);
                // console.log(objetos,"Objetos");
                normalizadorDeHoras(idSemana,idEmpleado);
            }
        }
        return ;

    } catch (error) {
        throw error;
    }
}


function verificarCoincidencia(arrayRegistros, objeto) {
    return arrayRegistros.filter(registro =>
        registro.idProyecto === objeto.idProyecto &&
        registro.diaSemana === objeto.diaSemana &&
        registro.sonHorasExtra === objeto.sonHorasExtra &&
        registro !== objeto // Evita incluir el mismo objeto en la coincidencia
    );

    // Incluye el objeto que estás evaluando al array de coincidencias
    // coincidencias.push(objeto);

    // return coincidencias;
}



async function manejarCoincidencias(arrayCoincidencias) {
    // console.log("Manejando coincidencias:", arrayCoincidencias);
    // Aquí puedes procesar los datos como sea necesario
    let objetoReciente = arrayCoincidencias.reduce((max, obj) => 
        obj.horaCreacion > max.horaCreacion ? obj : max
    );

    let objetosSumados = arrayCoincidencias.filter(obj => obj !== objetoReciente);
    let totalHorasExtras = objetosSumados.reduce((sum, obj) => sum + obj.horasTrabajadas, 0);
    let objetoFinal = objetoReciente.toObject(); 
    objetoFinal.horasTrabajadas += totalHorasExtras;

    return { objetoFinal, objetosSumados };

}


const eliminarRegistros = async (ids) => {
    try {
        console.log(ids,"los ids");
        const resultado = await HorasTrabajadas.deleteMany({ _id: { $in: ids } });

        if (resultado.deletedCount === 0) {
            throw new Error('No se encontraron registros para eliminar');
        }

        return { mensaje: `Se eliminaron ${resultado.deletedCount} registros` };
    } catch (error) {
        console.log(error);
        throw new Error(`Error al eliminar registros: ${error.message}`);
    }
};

const modificarRegistro = async (id, datosActualizados) => {
    try {
        // console.log(id +" HOLA A TODOS ");
        // console.log(datosActualizados);
        const registroActualizado = await HorasTrabajadas.findByIdAndUpdate(
            id,
            { $set: datosActualizados },
            { new: true } // Devuelve el objeto actualizado
        );

        if (!registroActualizado) {
            throw new Error('Registro no encontrado');
        }

        return registroActualizado;
    } catch (error) {
        throw new Error(`Error al modificar el registro: ${error.message}`);
    }
};














module.exports = {
    obtenerTotalHorasTrabajadas,
    tieneHorasExtras,
    obtenerHorasExtras,
    obtenerHoraMasTempranaDelDia,
    buscarSiHayHorasRegularesParaEseProyectoEnEseMismoDia,
    cambiarSonHorasExtra,
    transferirHorasYEliminar,
    obtenerSumaHorasExtras,
    obtenerSumaHorasRegulares,
    compararHorasTrabajadas,
    solucionSuperaHoras,
    solucionNoSuperan,
    solucionExacto,
    obtenerHoraRegularesMasLejana,
    obtenerHoraMasTardiaDelDia,
    determinarTipoProblema,
    solucionExacto_Regular,
    solucionNoSuperan_Regular,
    solucionSuperan_Regular,
    normalizadorDeHoras
}
