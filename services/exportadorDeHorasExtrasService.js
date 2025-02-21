const HorasExtrasViernes = require('../models/HoraExtraViernes');
const HorasTrabajadas = require('../models/HorasTrabajadas');
const mongoose = require('mongoose');

const buscarSiElEmpleadoTieneHorasExtras = async (idEmp) => {
    // Filtramos por idEmpleado
    const horasExtrasViernes = await HorasExtrasViernes.find({ idEmpleado: idEmp });

    // Verificamos si existen horas extras para el empleado
    if (horasExtrasViernes.length > 0) {
        // Si hay horas extras, las regresamos
        console.log(horasExtrasViernes, "Horas extras viernes");
        return horasExtrasViernes;
    } else {
        // Si no hay horas extras, retornamos null
        return null;
    }
}

const combinarHoras = async (data) =>{
    return Object.values(
        data.reduce((acc, item) => {
            const key = `${item.idProyecto}-${item.idEmpleado}-${item.idSemana}`;
            if (!acc[key]) {
                acc[key] = { ...item };
            } else {
                acc[key].horasTrabajadas += item.horasTrabajadas;
            }
            return acc;
        }, {})
    );
}

const transformarHoras = (horasExtrasArray,nuevoIdSemana) => {
    if (!Array.isArray(horasExtrasArray) || horasExtrasArray.length === 0) {
        console.log('El array de horas extra está vacío o no es válido.');
        return [];
    }

    return horasExtrasArray.map(hora => ({
        _id:hora._id,
        idSemana: nuevoIdSemana,
        idProyecto: hora.idProyecto,
        idEmpleado: hora.idEmpleado,
        nombreProyecto: hora.nombreProyecto,
        nombreEmpleado: hora.nombreEmpleado,
        horasTrabajadas: hora.horasTrabajadas,
        fecha: hora.fecha,
        diaSemana: "Viernes anterior",
        sonHorasExtra: false,
        excepcion: hora.excepcion,
        horaCreacion: hora.horaCreacion
    }));
};


const darDeAltaHorasTrabajadas = async (horasArray) => {
    if (!Array.isArray(horasArray) || horasArray.length === 0) {
        throw new Error('El array de horas trabajadas es inválido o está vacío.');
    }


    try {
        const resultado = await HorasTrabajadas.insertMany(horasArray);
        console.log(resultado)
        await eliminarHorasExtrasViernes(horasArray);
        return resultado;
    } catch (error) {
        console.error('Error al registrar horas trabajadas:', error);
        throw error;
    }
};

const eliminarHorasExtrasViernes = async (horasArray) => {
    console.log(horasArray,"Horas array");
    if (!Array.isArray(horasArray) || horasArray.length === 0) {
        throw new Error('El array de horas extra es inválido o está vacío.');
    }

    try {
        const ids = horasArray.map(hora => hora._id);
        const resultado = await HorasExtrasViernes.deleteMany({ _id: { $in: ids } });
        console.log('Horas extras de viernes eliminadas con éxito.');
        return resultado;
    } catch (error) {
        console.error('Error al eliminar horas extras de viernes:', error);
        throw error;
    }
};


const transferirHorasTrabajadas = async (registro) => {
    try {
    
        const nuevoRegistro = new HorasExtrasViernes({
            idSemana: registro.idSemana,
            idProyecto: registro.idProyecto,
            idEmpleado: registro.idEmpleado,
            nombreProyecto: registro.nombreProyecto,
            nombreEmpleado: registro.nombreEmpleado,
            horasTrabajadas: registro.horasTrabajadas,
            fecha: registro.fecha,
            diaSemana: "Viernes anterior",
            sonHorasExtra: registro.sonHorasExtra,
            excepcion: registro.excepcion,
            horaCreacion: registro.horaCreacion
        });

        await nuevoRegistro.save();
        console.log('Registro transferido con éxito');
    } catch (error) {
        console.error('Error al transferir:', error.message);
    }
};



const darDeAltaHorasClonadas = async (originalDocumento,nuevasHoras) => {
    try{
        const documentoSinId = { ...originalDocumento.toObject() };
        delete documentoSinId._id; 
         const nuevoDocumento = new HorasExtrasViernes({
                    ...documentoSinId,             // Copia todos los campos excepto `_id`
                    horasTrabajadas: nuevasHoras,  // Cambia las horas trabajadas
                    sonHorasExtra: true,          // Asegúrate de que sea `false`
                    _id: new mongoose.Types.ObjectId(), // Genera un nuevo ID válido
                    horaCreacion: Date.now()       // Actualiza la hora de creación
             });
        await nuevoDocumento.save();
        return nuevoDocumento;
    }
    catch(error){
        console.error(error,'Error al exprtar hra');

        throw error;
    }
};



module.exports = {
    buscarSiElEmpleadoTieneHorasExtras,
    transformarHoras,
    darDeAltaHorasTrabajadas,
    darDeAltaHorasClonadas,
    transferirHorasTrabajadas,
    combinarHoras

}