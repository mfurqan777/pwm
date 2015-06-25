/*
 * Password Management Servlets (PWM)
 * http://code.google.com/p/pwm/
 *
 * Copyright (c) 2006-2009 Novell, Inc.
 * Copyright (c) 2009-2015 The PWM Project
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 */

package password.pwm.ws.server.rest;

import password.pwm.PwmService;
import password.pwm.bean.PublicUserInfoBean;
import password.pwm.bean.UserInfoBean;
import password.pwm.error.ErrorInformation;
import password.pwm.error.PwmError;
import password.pwm.error.PwmException;
import password.pwm.error.PwmUnrecoverableException;
import password.pwm.ldap.UserStatusReader;
import password.pwm.util.JsonUtil;
import password.pwm.util.TimeDuration;
import password.pwm.util.logging.PwmLogger;
import password.pwm.util.stats.Statistic;
import password.pwm.util.stats.StatisticsManager;
import password.pwm.ws.server.RestRequestBean;
import password.pwm.ws.server.RestResultBean;
import password.pwm.ws.server.RestServerHelper;
import password.pwm.ws.server.ServicePermissions;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.net.URISyntaxException;
import java.util.Date;

@Path("/status")
public class RestStatusServer extends AbstractRestServer {
    public static final PwmLogger LOGGER = PwmLogger.forClass(RestStatusServer.class);

    @GET
    @Produces(MediaType.TEXT_HTML)
    public javax.ws.rs.core.Response doHtmlRedirect() throws URISyntaxException {
        return RestServerHelper.doHtmlRedirect();
    }

    @GET
    @Produces(MediaType.APPLICATION_JSON + ";charset=UTF-8")
    public Response doGetStatusData(
            @QueryParam("username") final String username
    ) {
        final Date startTime = new Date();
        final RestRequestBean restRequestBean;
        try {
            final ServicePermissions servicePermissions = new ServicePermissions();
            servicePermissions.setAdminOnly(false);
            servicePermissions.setAuthRequired(true);
            servicePermissions.setBlockExternal(true);
            restRequestBean = RestServerHelper.initializeRestRequest(request, response, servicePermissions, username);
        } catch (PwmUnrecoverableException e) {
            return RestResultBean.fromError(e.getErrorInformation()).asJsonResponse();
        }

        try {
            final UserInfoBean userInfoBean;
            if (restRequestBean.getUserIdentity() != null) {
                userInfoBean = new UserInfoBean();
                final UserStatusReader userStatusReader = new UserStatusReader(restRequestBean.getPwmApplication(),restRequestBean.getPwmSession().getLabel());
                userStatusReader.populateUserInfoBean(
                        userInfoBean,
                        restRequestBean.getPwmSession().getSessionStateBean().getLocale(),
                        restRequestBean.getUserIdentity(),
                        restRequestBean.getPwmSession().getSessionManager().getChaiProvider()
                );
            } else {
                userInfoBean = restRequestBean.getPwmSession().getUserInfoBean();
            }
            final RestResultBean restResultBean = new RestResultBean();
            restResultBean.setData(PublicUserInfoBean.fromUserInfoBean(
                    userInfoBean,
                    restRequestBean.getPwmApplication().getConfig(),
                    restRequestBean.getPwmSession().getSessionStateBean().getLocale()
            ));

            final StatisticsManager statsMgr = restRequestBean.getPwmApplication().getStatisticsManager();
            if (statsMgr != null && statsMgr.status() == PwmService.STATUS.OPEN) {
                if (restRequestBean.isExternal()) {
                    statsMgr.incrementValue(Statistic.REST_STATUS);
                }
            }

            final TimeDuration timeDuration = TimeDuration.fromCurrent(startTime);
            LOGGER.debug(restRequestBean.getPwmSession(),"completed REST status request in " + timeDuration.asCompactString() + ", result=" + JsonUtil.serialize(restResultBean));
            return restResultBean.asJsonResponse();
        } catch (PwmException e) {
            return RestResultBean.fromError(e.getErrorInformation(), restRequestBean).asJsonResponse();
        } catch (Exception e) {
            final String errorMsg = "unexpected error building json response: " + e.getMessage();
            final ErrorInformation errorInformation = new ErrorInformation(PwmError.ERROR_UNKNOWN, errorMsg);
            return RestResultBean.fromError(errorInformation, restRequestBean).asJsonResponse();
        }
    }
}
