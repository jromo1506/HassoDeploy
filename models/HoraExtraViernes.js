const mongoose = require('mongoose');
const { Schema } = mongoose;

const HorasTrabajadasViernesSchema = new Schema({
    idSemana: {
        type: String,
        ref: 'Semana',
        required: true
    },
    idProyecto: {
        type: String,
        ref: 'Proyecto',
        required: true
    },
    idEmpleado: {
        type: String,
        ref: 'Empleado',
        required: true
    },
    nombreProyecto: {
        type: String,
        required: true
    },
    nombreEmpleado:{
        type: String,
        required: true
    },
    horasTrabajadas:{
        type:Number,
        required:true
    },
    fecha: {
        type: Date,
        required: false
    },
    diaSemana:{
        type:String,
        required:true,
        default:"Viernes anterior"
    },
    sonHorasExtra:{
        type:Boolean,
        required:true
    },
    excepcion:{
        type:String,
        required:true,
    },
    horaCreacion:{
        type:Date,
        required:true,
        default:Date.now
    }

});


module.exports = mongoose.model('HorasTrabajadasViernes',HorasTrabajadasViernesSchema);

