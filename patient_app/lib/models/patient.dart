class Patient {
  final int id;
  final String name;
  final int? age;
  final String gender;
  final String? mobile;
  final String? address;
  final String? visitDate;
  final String? status;
  final String? doctor;

  Patient({
    required this.id,
    required this.name,
    this.age,
    required this.gender,
    this.mobile,
    this.address,
    this.visitDate,
    this.status,
    this.doctor,
  });

  factory Patient.fromJson(Map<String, dynamic> json) {
    return Patient(
      id: json['id'] as int,
      name: json['name'] as String? ?? '',
      age: json['age'] as int?,
      gender: json['gender'] as String? ?? 'OTHER',
      mobile: json['mobile'] as String?,
      address: json['address'] as String?,
      visitDate: json['visitDate'] as String?,
      status: json['status'] as String?,
      doctor: json['doctor'] as String?,
    );
  }

  String get ageSex {
    final ageStr = age != null ? '$age Yrs' : '';
    final sexStr = _formatGender(gender);
    if (ageStr.isEmpty) return sexStr;
    if (sexStr.isEmpty) return ageStr;
    return '$ageStr / $sexStr';
  }

  String _formatGender(String g) {
    switch (g.toUpperCase()) {
      case 'MALE': return 'Male';
      case 'FEMALE': return 'Female';
      default: return 'Other';
    }
  }

  bool get isCompleted => status?.toUpperCase() == 'COMPLETED';
}
