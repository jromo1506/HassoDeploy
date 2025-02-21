const HorasExtraViernes = require('../models/HoraExtraViernes');

exports.createHorasTrabajadas = async (req, res) => {
    console.log(req.body)
    try {
        const horasTrabajadas = new HorasExtraViernes(req.body);
        await horasTrabajadas.save();
        res.status(201).json(horasTrabajadas);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};



const updateHorasTrabajadas = async (req, res) => {
    try {
        const horasTrabajadas = await HorasTrabajadas.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!horasTrabajadas) {
            return res.status(404).json({ error: 'Horas trabajadas no encontradas' });
        }
        res.status(200).json(horasTrabajadas);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};