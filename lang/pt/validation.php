<?php

return [

'required' => 'O campo :attribute é obrigatório.',
'email' => 'O campo :attribute deve ser um email válido.',
'min' => [
    'string' => 'O campo :attribute deve ter pelo menos :min caracteres.',
],
'max' => [
    'string' => 'O campo :attribute não pode ter mais de :max caracteres.',
],
'unique' => 'Este :attribute já está registado.',
'confirmed' => 'A confirmação de :attribute não corresponde.',
'string' => 'O campo :attribute deve ser texto.',

'attributes' => [
    'name' => 'nome',
    'email' => 'email',
    'password' => 'palavra-passe',
],

];
