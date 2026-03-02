import os

GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID")
GCP_LOCATION = os.getenv("GCP_LOCATION")
LICENSE_ALLOCATION_QUEUE = os.getenv("LICENSE_ALLOCATION_QUEUE")
LICENSE_REVOCATION_QUEUE = os.getenv("LICENSE_REVOCATION_QUEUE")
DOWNTIME_START_QUEUE = os.getenv("DOWNTIME_START_QUEUE")
DOWNTIME_END_QUEUE = os.getenv("DOWNTIME_END_QUEUE")
LICENSE_MANAGEMENT_API_ENDPOINT = os.getenv("LICENSE_MANAGEMENT_API_ENDPOINT")
LICENSE_ENDPOINTS_INVOKER_SERVICE_ACCOUNT = os.getenv("LICENSE_ENDPOINTS_INVOKER_SERVICE_ACCOUNT")

DB_USER = os.getenv("DB_USER")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", 5432)
DB_NAME = os.getenv("DB_NAME")
DB_PASSWORD_SECRET_NAME = os.getenv("DB_PASSWORD_SECRET_NAME")

ALLOWED_ORIGINS = ["*"]
X_USER_CURRENT_TIME_HEADER = "x-user-current-time"
X_USER_TOKEN_HEADER = "x-user-token"
X_GOG_AUTHENTICATED_USER_EMAIL = "X-Goog-Authenticated-User-Email"

DELEGATED_ADMIN = os.getenv("DELEGATED_ADMIN")
ADMIN_SERVICE_ACCOUNT_KEY_SECRET_NAME = os.getenv("ADMIN_SERVICE_ACCOUNT_KEY_SECRET_NAME")
USER_CACHE_SIZE = 128
USER_CACHE_TTL_SECONDS = 3600
PORTAL_ADMIN_GROUP_EMAIL = os.getenv("PORTAL_ADMIN_GROUP_EMAIL")

MAX_RESERVATION_APPS = "maxReservationApplications"
MAX_CALENDAR_DAYS = "maxCalendarDays"
ROLLING_WINDOW_HOURS = "rollingWindowHours"
RESERVATION_LEAD_DAYS = "reservationLeadDays"
MAX_SLOTS_TO_FIND = "maxSlotsToFind"
UNAVAILABLE_RESERVATION_DAYS = "unavailableReservationDays"
RESERVATION_COOL_OFF_HOURS = "reservationCoolOffHours"
RESERVATION_EMAIL_SENDER = "reservationEmailSender"
BOOKED_RESERVATION_EMAIL_CONTENT = """
<!DOCTYPE html> 
<html lang="en"> 
<style> 
  body { background-color: #f0f0f0; padding: 20px; font-family: Google Sans, Roboto, Arial, Helvetica, sans-serif; } 
  .digest-block { background-color: #ffffff; border: 1px solid #dcdcdc; border-radius: 12px; padding: 12px 25px; display: inline-flex; align-items: center; box-shadow: 0 1px 2px rgba(0,0,0,0.05); } 
  .digest-icon { height: 30px; width: auto; margin-right: 12px; vertical-align: middle; } 
  .digest-text { font-size: 18px; font-weight: bold; color: #000000; white-space: nowrap; } 
</style> 
<head> 
    <meta charset="UTF-8"> 
    <meta name="viewport" content="width=device-width, initial-scale=1.0"> 
    <title>SaaS Reservation Confirmation</title> 
</head> 
<body style="margin: 0; padding: 0; background-color: #f4f4f4;"> 
    <!-- Team Badge Section --> 
    <table border="0" cellpadding="0" cellspacing="0" width="100%"> 
      <tr> 
        <td style="padding: 20px 0;">  
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; background-color: #ffffff; border-radius: 12px;"> 
            <tr> 
              <td align="center" style="padding: 15px 25px;">  
                 <div class="digest-block" style="background-color: transparent; border: none; box-shadow: none; padding: 0; display: inline-flex; align-items: center;"> 
                    <img src="https://www.gstatic.com/images/branding/product/1x/google_cloud_48dp.png" alt="goldemos icon" class="digest-icon" style="vertical-align: middle;"> 
                    <span class="digest-text" style="font-size: 24px; vertical-align: middle; margin-left: 12px;">Demo License Reservation</span> 
                 </div> 
              </td> 
            </tr> 
          </table> 
        </td> 
      </tr> 
    </table> 
    <!-- End Team Badge Section --> 

    <!-- Main Content Section --> 
    <table border="0" cellpadding="0" cellspacing="0" width="100%"> 
        <tr> 
            <td style="padding: 20px 0;"> 
                <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; background-color: #ffffff; border-radius: 12px;"> 
                    <!-- Header within the white card --> 
                    <tr> 
                        <td align="left" bgcolor="#ffffff" style="padding: 10px 30px 20px 30px; border-bottom: 1px solid #eeeeee; border-top-left-radius: 12px; border-top-right-radius: 12px;">                            
                            <div style="color: #202124; font-family: 'Google Sans', Roboto, Arial, sans-serif; font-size: 22px; line-height: 1.3; padding-top: 4px;"> 
                                Reservation Confirmation
                            </div> 
                        </td> 
                    </tr> 
                    <!-- Content Body --> 
                    <tr> 
                        <td bgcolor="#ffffff" style="padding: 20px 30px 40px 30px; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;"> 
                            <p style="margin: 0 0 15px 0; color: #3c4043; font-family: Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.5;"> 
                                Hello,
                            </p> 
                            <p style="margin: 0 0 15px 0; color: #3c4043; font-family: Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.5;"> 
                                This email confirms your demo reservation for the following SaaS licenses:
                            </p> 
                            <!-- Placeholder for dynamic reservation details -->
                            <div style="font-family: Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #3c4043;"> 
                                {{ dynamic_reservation_details }}
                            </div>
                            
                            <p style="margin: 20px 0 15px 0; color: #3c4043; font-family: Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.5;"> 
                                You can manage your reservation(s) by logging into the demo user licensing app. Please follow the demo guide "How to log-in" section for details on how to access these applications.
                            </p> 
                            <p style="margin: 0; color: #5f6368; font-family: Roboto, Arial, sans-serif; font-size: 12px; line-height: 1.5;"> 
                                This is an automated message, so please do not reply directly to this email. For assistance, click the Feedback button on the demo page or the demo app.
                            </p> 
                            <p style="margin-top: 15px; color: #3c4043; font-family: Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.5;">                                
                                Thank you,<br>
                                Team <a href="https://cloud-demo-hub.corp.google.com" style="color: blue; text-decoration: none;">go/demos</a><br>
                                <a href="https://moma.corp.google.com/team/2040279160758?hq=type%3Ateams&q=cloud%20demo%20platform" style="color: blue; text-decoration: none;">Cloud Demo Platform</a>
                            </p>
                        </td> 
                    </tr> 
                </table> 
            </td> 
        </tr> 
    </table> 
    <!-- End Main Content Section --> 
</body> 
</html>
"""
CANCELLED_RESERVATION_EMAIL_CONTENT = """
<!DOCTYPE html>
<html lang="en">
<style>
  body { background-color: #f0f0f0; padding: 20px; font-family: Google Sans, Roboto, Arial, Helvetica, sans-serif; }
  .digest-block { background-color: #ffffff; border: 1px solid #dcdcdc; border-radius: 12px; padding: 12px 25px; display: inline-flex; align-items: center; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
  .digest-icon { height: 30px; width: auto; margin-right: 12px; vertical-align: middle; }
  .digest-text { font-size: 18px; font-weight: bold; color: #000000; white-space: nowrap; }
</style>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SaaS Reservation Cancellation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
    <!-- Team Badge Section -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td style="padding: 20px 0;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; background-color: #ffffff; border-radius: 12px;">
            <tr>
              <td align="center" style="padding: 15px 25px;">
                  <div class="digest-block" style="background-color: transparent; border: none; box-shadow: none; padding: 0; display: inline-flex; align-items: center;">
                    <img src="https://www.gstatic.com/images/branding/product/1x/google_cloud_48dp.png" alt="goldemos icon" class="digest-icon" style="vertical-align: middle;">
                    <span class="digest-text" style="font-size: 24px; vertical-align: middle; margin-left: 12px;">Demo License Reservation</span>
                  </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <!-- End Team Badge Section -->

    <!-- Main Content Section -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
            <td style="padding: 20px 0;">
                <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; background-color: #ffffff; border-radius: 12px;">
                    <!-- Header within the white card -->
                    <tr>
                        <td align="left" bgcolor="#ffffff" style="padding: 10px 30px 20px 30px; border-bottom: 1px solid #eeeeee; border-top-left-radius: 12px; border-top-right-radius: 12px;">                            
                            <div style="color: #202124; font-family: 'Google Sans', Roboto, Arial, sans-serif; font-size: 22px; line-height: 1.3; padding-top: 4px;">
                                Reservation Cancellation
                            </div>
                        </td>
                    </tr>
                    <!-- Content Body -->
                    <tr>
                        <td bgcolor="#ffffff" style="padding: 20px 30px 40px 30px; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;">
                            <p style="margin: 0 0 15px 0; color: #3c4043; font-family: Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.5;">
                                Hello,
                            </p>
                            <p style="margin: 0 0 15px 0; color: #3c4043; font-family: Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.5;">
                                This email confirms the cancellation of your demo reservation for the following SaaS licenses:
                            </p>
                            <!-- Placeholder for dynamic reservation details -->
                            <div style="font-family: Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #3c4043;">
                                {{ dynamic_reservation_details }}
                            </div>
                            
                            <p style="margin: 20px 0 15px 0; color: #3c4043; font-family: Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.5;">
                                You can manage your reservation(s) by logging into the demo user licensing app. Please follow the demo guide "How to log-in" section for details on how to access these applications.
                            </p>
                            <p style="margin: 0; color: #5f6368; font-family: Roboto, Arial, sans-serif; font-size: 12px; line-height: 1.5;">
                                This is an automated message, so please do not reply directly to this email. For assistance, click the Feedback button on the demo page or the demo app.
                            </p>
                            <p style="margin-top: 15px; color: #3c4043; font-family: Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.5;">
                                Thank you,<br>
                                Team <a href="https://cloud-demo-hub.corp.google.com" style="color: blue; text-decoration: none;">go/demos</a><br>
                                <a href="https://moma.corp.google.com/team/2040279160758?hq=type%3Ateams&q=cloud%20demo%20platform" style="color: blue; text-decoration: none;">Cloud Demo Platform</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
    <!-- End Main Content Section -->
</body>
</html>
"""
ACCOUNT_CUSTOMERID = "C03ff1ejf"
MIN_LEAD_COOLDOWN_HOURS = "minLeadCooldownHours"
MAX_RESERVATION_LEAD_DAYS = "maxReservationLeadDays"
ALTOSTRAT_CLIENT_ID = "altostrat_client_id"
LICENSE_APP_ADMIN_GROUP_EMAIL = "PORTAL_ADMIN_GROUP_EMAIL"
ADMIN_VALIDATION_KEYS_SECRET_NAME = os.getenv("ADMIN_VALIDATION_KEYS_SECRET_NAME")
LICENSE_PROVISIONING_LEAD_TIME_MINUTES = 30