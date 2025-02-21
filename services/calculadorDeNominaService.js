// SERVICIO ENCARGADO DE CALCULAR LAS NOMINAS


/*
    Se utiliza para recalcular la nomina
    cada vez que se hace algun movimiento en las
    horas

*/

const Nomina = require('../models/Nomina');
const HorasTrabajadas = require('../models/HorasTrabajadas');
const Empleado = require('../models/Empleado');



const recalcularNomina = async(idSemana,idEmpleado) =>{
    try{
        console.log(require.resolve('../models/HorasTrabajadas'));
        console.log(typeof HorasTrabajadas.find ,"TIPOOO");
        const nomina = await buscarNominaEmpleado(idSemana,idEmpleado);
        const pagoEmp = await obtenerSueldoPorHoraEmpleado(idEmpleado);
        const horas = await obtenerSumarHorasExtrasRegulares(idEmpleado,idSemana);
        const sueldoHoras = await calcularPago(pagoEmp,horas.totalHorasRegulares,horas.totalHorasExtras);
        const nominaRecalculada = await calcularCamposNomina(sueldoHoras,nomina,horas);
        const nominaActualizada = await modificarNomina(nominaRecalculada,idSemana,idEmpleado);
        return nominaActualizada;
    }
    catch(error){
        throw error;
    }
}


const obtenerSueldoPorHoraEmpleado = async(idEmpleado) =>{
    try{
        // console.log(idEmpleado,"Id");
        const empleado  = await Empleado.findById(idEmpleado);
        if (!empleado) {
            throw new Error("Empleado no encontrado"); // O simplemente return null;
        }
        return empleado.pago;
    }
    catch(error){
        console.log("Error al encontrar el empleado");
        throw error;
    }
}


const obtenerSumarHorasExtrasRegulares = async(idEmpleado, idSemana)=> {
    try {
        console.log("Se va a eliminar " + idSemana + " " + idEmpleado)
        // Obtiene todas las horas
        const horas = await HorasTrabajadas.find({ idEmpleado, idSemana });
    
        const totalHorasExtras = horas.filter(h => h.sonHorasExtra).reduce((sum, h) => sum + h.horasTrabajadas, 0);
        const totalHorasRegulares = horas.filter(h => !h.sonHorasExtra).reduce((sum, h) => sum + h.horasTrabajadas, 0);
        
        return { totalHorasExtras, totalHorasRegulares };
    } catch (error) {
        console.error('Error al obtener y procesar las horas:', error);
        throw error;
    }
}


const calcularPago = async(sueldoPorHora,totalHorasRegulares,totalHorasExtras) => {
    const sueldoRegulares = sueldoPorHora * totalHorasRegulares;
    const sueldoExtras = (sueldoPorHora * 2) * totalHorasExtras;
    
    return sueldoRegulares + sueldoExtras;
}


const buscarNominaEmpleado = async(idSemana,idEmpleado) => {
    try{
        // console.log(idEmpleado + " " +idSemana);
        const nomina = await Nomina.findOne({ idSemana: idSemana, idEmpleado: idEmpleado });
       
        if(!nomina){
            throw new Error("No se encontro ninguna nomina");
        }
        return nomina;
    }
    catch(error){
        throw error;
    }
}






const calcularCamposNomina = async(sumaSueldoHoras,nomina,horasTrabajadas) =>{
    try{
       nomina.horasFaltantes = horasTrabajadas.totalHorasRegulares + horasTrabajadas.totalHorasExtras;
       nomina.horasRegulares = horasTrabajadas.totalHorasRegulares;
       nomina.horasExtras = horasTrabajadas.totalHorasExtras;
       nomina.totalNomina =nomina.sobreSueldo + nomina.finiquito +sumaSueldoHoras;
       nomina.lesDoy = nomina.totalNomina + nomina.prestamo - nomina.abonan - nomina.pension;
       nomina.dispEfectivo = nomina.lesDoy - nomina.nominaFiscal;
       return nomina;

    }
    catch(error){
        console.error('Error al obtener y procesar las horas:', error);
        throw error;
    }
}


const modificarNomina = async(nomina,idSemana,idEmpleado) =>{
    try{
        const exito = await Nomina.findOneAndUpdate(
            {idSemana,idEmpleado},
            nomina,
            { new: true }
        );
        if (!exito) {
            throw new Error("Error al actualizar");
        }
        console.log("Nomina actualizada cone xito");

        return exito;

    }
    catch(error){
        throw error;
    }
}




module.exports = {
    recalcularNomina
}