namespace py login_service

struct LoginRequest {
    1: string username,
    2: string password,
    3: string device_id
}

struct LoginResponse {
    1: bool success,
    2: string message,
    3: optional string session_token,
    4: optional i64 timestamp
}

service LoginService {
    LoginResponse authenticate(1: LoginRequest request),
    bool logout(1: string session_token),
    bool check_session(1: string session_token)
}
