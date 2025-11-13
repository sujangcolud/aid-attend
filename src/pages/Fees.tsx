import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const Fees = () => {
    const [fees, setFees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [studentId, setStudentId] = useState('');
    const [monthYear, setMonthYear] = useState('');
    const [feeData, setFeeData] = useState({
        id: null,
        student_id: '',
        center_id: 'YOUR_CENTER_ID', // Update based on user's access rights
        fee_amount: '',
        month_year: '',
        due_date: '',
        remarks: '',
        paid: false,
    });

    useEffect(() => {
        fetchFees();
    }, []);

    const fetchFees = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('monthly_fees')
            .select('*')
            .eq('center_id', 'YOUR_CENTER_ID'); // Only if not an admin

        if (error) {
            setError(error.message);
        } else {
            setFees(data);
        }
        setLoading(false);
    };

    const handleInputChange = (e) => {
        setFeeData({ ...feeData, [e.target.name]: e.target.value });
    };

    const createOrUpdateFee = async () => {
        const { data, error } = await supabase
            .from('monthly_fees')
            .upsert({
                ...feeData,
                created_at: new Date(),
                updated_at: new Date(),
            }, { onConflict: ['student_id', 'month_year'] });

        if (error) {
            if (error.code === '23505') { // Unique violation
                setError('Fee for this student and month_year already exists.');
            } else {
                setError(error.message);
            }
        } else {
            fetchFees();
            resetForm();
        }
    };

    const togglePaidStatus = async (fee) => {
        const { data, error } = await supabase
            .from('monthly_fees')
            .update({ 
                paid: !fee.paid,
                payment_date: !fee.paid ? new Date() : null,
                updated_at: new Date(),
            })
            .eq('id', fee.id);

        if (error) {
            setError(error.message);
        } else {
            fetchFees();
        }
    };

    const resetForm = () => {
        setFeeData({
            id: null,
            student_id: '',
            center_id: 'YOUR_CENTER_ID', // Reset if necessary
            fee_amount: '',
            month_year: '',
            due_date: '',
            remarks: '',
            paid: false,
        });
    };

    return (
        <div>
            <h1>Monthly Fees</h1>
            {loading && <p>Loading...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <table>
                <thead>
                    <tr>
                        <th>Student ID</th>
                        <th>Fee Amount</th>
                        <th>Month/Year</th>
                        <th>Due Date</th>
                        <th>Payment Date</th>
                        <th>Remarks</th>
                        <th>Paid</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {fees.map(fee => (
                        <tr key={fee.id}>
                            <td>{fee.student_id}</td>
                            <td>{fee.fee_amount}</td>
                            <td>{fee.month_year}</td>
                            <td>{fee.due_date}</td>
                            <td>{fee.payment_date}</td>
                            <td>{fee.remarks}</td>
                            <td>
                                <input
                                    type="checkbox"
                                    checked={fee.paid}
                                    onChange={() => togglePaidStatus(fee)}
                                />
                            </td>
                            <td>
                                <button onClick={() => setFeeData(fee)}>Edit</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div>
                <h2>{feeData.id ? 'Edit Fee' : 'Create Fee'}</h2>
                <input name="student_id" value={feeData.student_id} onChange={handleInputChange} placeholder="Student ID" />
                <input name="fee_amount" value={feeData.fee_amount} onChange={handleInputChange} placeholder="Fee Amount" />
                <input name="month_year" value={feeData.month_year} onChange={handleInputChange} placeholder="Month/Year" />
                <input name="due_date" type="date" value={feeData.due_date} onChange={handleInputChange} />
                <input name="remarks" value={feeData.remarks} onChange={handleInputChange} placeholder="Remarks" />
                <button onClick={createOrUpdateFee}>{feeData.id ? 'Update Fee' : 'Create Fee'}</button>
                <button onClick={resetForm}>Cancel</button>
            </div>
        </div>
    );
};

export default Fees;